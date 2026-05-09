# Happy Cake — deploy notes

Two-tier production setup, both on **DigitalOcean**:

```
        happycake.flowleads.dev
                │
                ▼
   ┌────────────────────────────┐
   │  DO App Platform           │   Next.js website (this folder)
   │  (managed, autoscale)      │   — spec: .do/app.yaml
   └────────────────────────────┘
                │  /api/* rewrites
                ▼
   ┌────────────────────────────┐
   │  DO Droplet                │   Hono backend (../src/server.ts)
   │  (Bun + claude -p)         │   — spawns claude -p subprocesses
   └────────────────────────────┘
                │
                ▼
        Sandbox MCP + Telegram bots
```

The website ships as the App Platform service. The backend can't sit on App
Platform because it spawns the `claude -p` CLI per request, which the App
Platform container runtime is unfriendly to. Backend runs on a droplet (or
on the operator's laptop with a tunnel during the hackathon — see the
laptop-mode notes in [docs/05-deploy/DEPLOY.md](../docs/05-deploy/DEPLOY.md)).

---

## Tier 1 — Website on App Platform (`/.do/app.yaml`)

The spec is checked in at [`.do/app.yaml`](../.do/app.yaml). Apply it from
this repo's root:

```bash
# First-time apply under your DO project (e.g. "owl"):
doctl auth init                                # if doctl isn't already authed
doctl projects list                            # find the "owl" project id
doctl apps create --spec .do/app.yaml --project-id <owl-project-id>

# Subsequent updates (after editing the spec):
doctl apps list                                # find APP_ID for happycake-web
doctl apps update <APP_ID> --spec .do/app.yaml
```

`deploy_on_push: true` is set, so any commit to `main` triggers a fresh build
automatically. You don't need to re-run `doctl apps update` for code changes
— only for spec changes (env-var schema, build command, instance size).

### Required env on the App (set in dashboard, not in spec)

The spec slots `BACKEND_URL` as a placeholder; the real value lives in
**Settings → Env Variables** and is marked as a secret so it's not visible
in `doctl apps spec get`. Set it to either:

- The droplet's reverse-proxy URL: `https://happycake-api.flowleads.dev`
- A direct droplet URL: `http://<droplet-ip>:3000` (only works if peered or
  the droplet is on a public IP and you're OK with HTTP between them)
- The operator's tunnel for hackathon mode: `https://<your-tunnel>.ngrok-free.app`

Without `BACKEND_URL`, Next's rewrites fall back to `http://localhost:3000`
which doesn't resolve from inside an App Platform container — the frontend
will surface "kitchen system offline" on every order/chat attempt.

### Other env on the App

| Variable | Required | Notes |
|---|---|---|
| `BACKEND_URL` | **yes** | See above. |
| `NEXT_PUBLIC_SITE_URL` | yes | Used in JSON-LD `@id` URLs. Already in spec. |
| `NODE_ENV` | yes | `production`. Already in spec. |
| `NEXT_PUBLIC_BACKEND_URL` | optional | Only needed if any client code hits the backend directly (we don't today). |

### App Platform smoke check

```bash
curl -sI https://happycake.flowleads.dev | head -1
# → HTTP/2 200

curl -s https://happycake.flowleads.dev/api/products | head -c 200
# → { "products": [ { "id": "honey-cake-slice", ... } ] }
# If this returns HTML, the backend isn't reachable from App Platform —
# rotate BACKEND_URL in the dashboard and re-deploy.
```

---

## Tier 2 — Backend on a droplet

Pick one of your existing DigitalOcean droplets (e.g. `flowleads-us` at
143.198.11.219, configured in `~/.ssh/config`) or spin up a new 2 vCPU /
4 GB Ubuntu droplet under the "owl" project.

### One-time droplet setup

```bash
ssh root@<droplet>                                   # or: ssh flowleads-us
apt update && apt install -y curl git build-essential
curl -fsSL https://bun.sh/install | bash
ln -sf /root/.bun/bin/bun /usr/local/bin/bun
npm install -g @anthropic-ai/claude-code            # the agent runtime
claude /login                                        # populates ~/.claude/.credentials.json
```

### Clone + run

```bash
git clone git@github.com:aissayev/sbc-hackathon.git
cd sbc-hackathon
cp .env.example .env.local
# Fill in: SBC_TEAM_TOKEN, TG_OWNER_BOT_TOKEN, TG_OWNER_CHAT_ID,
# TG_CONCIERGE_BOT_TOKEN, etc. See .env.example for the full list.

bun install
bun src/scripts/db-init.ts --seed                   # apply schema + canonical catalog (10 products)
bun src/server.ts                                   # foreground; daemonize via systemd or pm2
```

### Reverse proxy on the droplet

The website's App Platform deploy hits `BACKEND_URL` over HTTPS. Front the
backend with Caddy or Nginx for TLS. Caddyfile example:

```caddy
happycake-api.flowleads.dev {
    reverse_proxy 127.0.0.1:3000
}
```

Then in the App Platform dashboard, set `BACKEND_URL=https://happycake-api.flowleads.dev`.

### Re-seed after schema/seed changes

The seed is upsert-on-id, so re-running is safe:

```bash
ssh <droplet>
cd /path/to/sbc-hackathon
git pull
bun src/scripts/db-init.ts --seed
# Restart the backend supervisor to clear any in-memory product cache.
```

---

## Owner portrait + family photo (optional, recommended)

The `/about` page references two local images that are **not** on the
public hackathon CDN:

- `web/public/assets/team/owner-askhat.jpg` — about-page hero
- `web/public/assets/team/family-couple.jpg` — values section (optional)

Drop the binaries into the repo before pushing to main. The `HeroImage`
component falls back to a brand-pattern panel if the file 404s, so the page
never breaks — but the real photo is much better.

---

## Smoke checks after every deploy

Run these end-to-end after either tier changes:

```bash
# 1) Website is up
curl -sI https://happycake.flowleads.dev | head -1
# → HTTP/2 200

# 2) Catalog reaches the backend
curl -s https://happycake.flowleads.dev/api/products | head -c 200
# → { "products": [ { "id": "honey-cake-slice", ... } ] }

# 3) Order draft writes through to the SQLite
curl -s -X POST https://happycake.flowleads.dev/api/orders/draft \
  -H 'Content-Type: application/json' \
  -d '{"thread_id":"smoke","channel":"web","items":[{"product_id":"honey-cake-slice","quantity":1}]}'
# → { "order_id": "ord_...", "total_cents": 850, ... }

# 4) Lead capture works
curl -s -X POST https://happycake.flowleads.dev/api/leads/b2b \
  -H 'Content-Type: application/json' \
  -d '{"contact":"smoke@test","meta":{"company":"Test"}}'
# → { "ok": true, "lead_id": "lead_...", "next_step": "awaiting_owner_review" }

# 5) Agent surface
curl -s https://happycake.flowleads.dev/llms.txt | head -3
# → starts with "# Happy Cake — agent-readable surface"
```

If 2/3/4 return HTML pages instead of JSON, the App Platform → droplet hop
is broken. Most likely: `BACKEND_URL` is wrong in the App's env, or the
backend supervisor on the droplet isn't running. Check `doctl apps logs <APP_ID>`
and the droplet's systemd / pm2 logs.

---

## Rolling back

The **website** rolls back via App Platform:

```bash
doctl apps list-deployments <APP_ID>           # shows recent deploys
doctl apps create-deployment <APP_ID>          # rolls forward; pass --force-rebuild for a clean build
# To pin to an old commit: edit .do/app.yaml temporarily to point at a tag,
# then `doctl apps update --spec`.
```

The **backend** rolls back on the droplet:

```bash
ssh <droplet>
cd /path/to/sbc-hackathon
git log --oneline main -10                     # find the prior good SHA
git checkout <sha>
bun install
# Restart the supervisor (systemctl / pm2).
```

Each PR is a single squash commit on `main`, so the rollback target is
always `git log --oneline main^1`.
