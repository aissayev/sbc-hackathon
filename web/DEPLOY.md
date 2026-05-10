# Happy Cake — deploy notes

**Current architecture (hackathon mode):**

```
       happycake.flowleads.dev
                │
                ▼
   ┌────────────────────────────┐
   │  DO App Platform           │   Next.js website (this folder)
   │  — spec: .do/app.yaml      │   — auto-deploys on push to main
   └────────────────────────────┘
                │
                │  BACKEND_URL  =  https://<your-tunnel>.ngrok-free.app
                ▼
   ┌────────────────────────────┐
   │  Your laptop               │   Hono backend (../src/server.ts)
   │  bun src/server.ts :3000   │   spawns `claude -p` per request
   │      ↑                     │
   │  ngrok / cloudflared       │   exposes :3000 publicly
   └────────────────────────────┘
                │
                ▼
        Sandbox MCP + Telegram bots
```

**Why this split:** the website is a stateless Next.js app — App Platform
runs it cheaply, scales it, terminates TLS, and redeploys on push. The
backend spawns `claude -p` per agent request and writes SQLite, so it stays
local during the hackathon and migrates to a droplet later. This file
documents the local-backend path; the
[droplet migration notes](#future-tier-2--backend-on-a-droplet) are at the
bottom.

---

## Tier 1 — Website on App Platform

### Apply / re-apply the spec

The spec is checked in at [`.do/app.yaml`](../.do/app.yaml). To apply it
under your DO project (e.g. `owl`):

```bash
doctl auth init                                # see "Connecting doctl" below
doctl projects list                            # find your owl project id
doctl apps create --spec .do/app.yaml --project-id <owl-project-id>

# Subsequent spec updates:
doctl apps list                                # find APP_ID for happycake-web
doctl apps update <APP_ID> --spec .do/app.yaml
```

`deploy_on_push: true` means any commit to `main` triggers a fresh build
automatically — you don't re-run `doctl apps update` for code changes, only
for spec changes (env schema, build command, instance size).

### Env vars on the App (set in the dashboard, not in spec)

| Variable | Required | Where it points (hackathon mode) |
|---|---|---|
| `BACKEND_URL` | **yes** | `https://<your-tunnel>.ngrok-free.app` — the laptop tunnel. |
| `NEXT_PUBLIC_SITE_URL` | yes | `https://happycake.flowleads.dev`. Already in spec. |
| `NODE_ENV` | yes | `production`. Already in spec. |

`BACKEND_URL` is a SECRET in the App's Settings → Env Variables. The spec
ships `REPLACE_IN_DASHBOARD` so the real URL doesn't end up in version
control. The tunnel URL changes whenever ngrok restarts on the free plan
— if customers report "kitchen offline", first thing to check is whether
the tunnel still matches what's set in the dashboard.

### App Platform smoke checks

```bash
curl -sI https://happycake.flowleads.dev | head -1
# → HTTP/2 200

curl -s https://happycake.flowleads.dev/api/products | head -c 200
# → { "products": [ { "id": "honey-cake-slice", ... } ] }
# If this returns HTML instead of JSON, BACKEND_URL → tunnel link is broken.
```

---

## Tier 2 — Backend on your laptop (current canonical path)

### One-time machine setup

```bash
# Bun runtime
curl -fsSL https://bun.sh/install | bash

# Claude Code CLI (the agent runtime — Claude Max session, no API key needed)
npm install -g @anthropic-ai/claude-code
claude /login                                   # interactive login once

# Tunnel — pick one
brew install ngrok                              # or:
brew install cloudflared
```

### Run the backend

```bash
cd /Users/adilet/workspace/sbc-hackathon
cp .env.example .env.local                      # fill in SBC_TEAM_TOKEN, TG_*, etc.
bun install
bun src/scripts/db-init.ts --seed               # apply schema + 10-product canonical catalog
bun src/server.ts                               # foreground; or daemonize with pm2 / launchd
```

### Open the tunnel

```bash
ngrok http 3000
# Forwarding   https://abc123.ngrok-free.app -> http://localhost:3000
```

Copy the `https://abc123...` URL into App Platform → Settings → Env Variables
→ `BACKEND_URL`. App Platform will redeploy on save (~30s).

ngrok's free tier rotates the URL on every restart — for a stable URL,
`ngrok http 3000 --domain=happycake-api.your-subdomain.ngrok-free.app`
(reserved subdomain on the free plan), or `cloudflared tunnel route dns
happycake-api flowleads.dev` if you want a flowleads.dev subdomain.

### Verify end-to-end

```bash
# Local backend up?
curl -s http://localhost:3000/api/products | head -c 100

# Tunnel passes through?
curl -s https://abc123.ngrok-free.app/api/products | head -c 100

# Website → tunnel → backend?
curl -s https://happycake.flowleads.dev/api/products | head -c 100
# Same response on all three = the loop is closed.
```

---

## Connecting `doctl` — DO Personal Access Token vs OAuth

Two ways to authenticate with DigitalOcean's API. **For 99% of cases (managing
your own apps via doctl), use a Personal Access Token (PAT). OAuth is only
relevant if you're building something that authenticates other DO users.**

### Personal Access Token (the one you want)

1. Go to **https://cloud.digitalocean.com/account/api/tokens**.
2. Click **Generate New Token**. Name it (e.g. `doctl-laptop`), pick scopes
   (Read + Write covers everything; Read alone is fine for inspections).
   Set an expiry (90 days is a sane default; rotate on calendar).
3. Copy the token — it's shown **once**, you can't fetch it again.
4. Authenticate doctl:
   ```bash
   doctl auth init                              # paste the token at the prompt
   doctl auth init --context owl                # or store under a named context
   doctl auth switch --context owl              # switch active token
   doctl account get                            # smoke check — should print your email
   ```
5. From here `doctl apps list`, `doctl projects list`, etc. all work.

### OAuth — only if you're hitting `cloud.digitalocean.com/v1/oauth/token/info`

That endpoint introspects an OAuth access token; it's part of the DO OAuth
2.0 Authorization Code flow, not the PAT flow. You'd use it if:

- You're building a third-party app that lets DO users log in with their DO
  account (and you need to validate the access token they hand you).
- You went through `https://cloud.digitalocean.com/v1/oauth/authorize?...`
  and now have an `access_token` you want to inspect.

**You almost certainly don't want this for managing your own apps.** Use a
PAT instead.

If you actually need the OAuth flow:

1. Register an OAuth application at
   **https://cloud.digitalocean.com/account/api/applications** — get a
   `client_id`, `client_secret`, and a `redirect_uri`.
2. Send your user to the authorize URL:
   ```
   https://cloud.digitalocean.com/v1/oauth/authorize
     ?client_id=<your-client-id>
     &response_type=code
     &redirect_uri=<your-redirect>
     &scope=read+write
   ```
3. Exchange the returned `code` at the token endpoint:
   ```bash
   curl -X POST https://cloud.digitalocean.com/v1/oauth/token \
     -d grant_type=authorization_code \
     -d code=<the-code> \
     -d client_id=<your-client-id> \
     -d client_secret=<your-client-secret> \
     -d redirect_uri=<your-redirect>
   # → { "access_token": "...", "token_type": "Bearer", "expires_in": 2592000, ... }
   ```
4. Introspect the token at `/v1/oauth/token/info`:
   ```bash
   curl -H "Authorization: Bearer <access_token>" \
     https://cloud.digitalocean.com/v1/oauth/token/info
   # → { "info": { "scopes": [...], "expires_in_seconds": ..., ... } }
   ```

The token-info endpoint is essentially "tell me about this token I hold" —
useful for checking expiry/scope before making other calls. It's not a way
to *get* a token; you have to already have one.

For Happy Cake's deploy needs, you don't go anywhere near OAuth. PAT +
`doctl auth init` is the whole story.

---

## Re-seeding the local backend after schema or catalog changes

The seed is upsert-on-id, safe to re-run:

```bash
cd /Users/adilet/workspace/sbc-hackathon
git pull
bun src/scripts/db-init.ts --seed
# → seeded 10 products
```

If you've been running the backend, restart it so any in-memory caches
clear. `Ctrl+C` and re-run `bun src/server.ts`.

---

## Image storage — DigitalOcean Spaces

All photos and videos served by the website live on **DigitalOcean Spaces**
(S3-compatible object storage with built-in CDN). The site reads them
through `NEXT_PUBLIC_CDN_BASE`, which defaults to the hackathon CDN until
you flip it to your own bucket.

### Bucket layout (mirrors `web/src/lib/brand.ts`)

```
happycake-assets/
├── logo/
│   ├── happy-cake-logo-256.png
│   ├── happy-cake-logo-512.png
│   └── happy-cake-logo-1024.png
├── hero/
│   ├── happy-cake-hero-01.webp
│   └── ... (04 total)
├── products/
│   ├── happy-cake-product-01.webp
│   └── ... (10 total)
├── social/
│   ├── happy-cake-social-01.webp
│   └── ... (08 total)
├── team/
│   ├── owner-askhat.jpg
│   └── family-couple.jpg
└── uploads/                                ← runtime-uploaded content
    ├── threads/<thread_id>/<date>_<id>.<ext>     chat attachments
    ├── orders/<order_id>/<date>_<id>.<ext>       custom-cake / B2B refs
    └── admin/<date>_<id>.<ext>                   owner-uploaded misc
```

### Step 1 — create the bucket

```bash
export DIGITALOCEAN_ACCESS_TOKEN="<your-PAT>"
doctl spaces create happycake-assets --region nyc3
# Move it under the owl project for tidiness:
doctl projects resources assign <owl-project-id> --resource=do:space:happycake-assets
```

### Step 2 — generate Spaces access keys

These are S3-style credentials, separate from the DO PAT.

1. Go to https://cloud.digitalocean.com/account/api/spaces
2. **Generate New Key** → name `happycake-backend`, scope to the
   `happycake-assets` bucket only.
3. Copy the **Access Key** and **Secret** (Secret shown once).

### Step 3 — fill in `.env.local`

```bash
SPACES_REGION=nyc3
SPACES_BUCKET=happycake-assets
SPACES_ENDPOINT=https://nyc3.digitaloceanspaces.com
SPACES_CDN_BASE=https://happycake-assets.nyc3.cdn.digitaloceanspaces.com
SPACES_KEY=<the-access-key>
SPACES_SECRET=<the-secret>
```

`.env.local` is gitignored. `.env.example` ships the schema with empty
slots; never put real keys in `.env.example`.

### Step 4 — migrate brand assets to your bucket

The migration script pulls every file the site uses from the hackathon
CDN, stages them locally, and pushes to your bucket with public-read ACL
+ immutable cache headers.

```bash
brew install s3cmd                                 # one-time
bash scripts/migrate-images-to-spaces.sh           # safe to re-run
```

The script reads from `.env.local`, writes a one-shot `s3cmd` config to
`/tmp` (deleted on exit, never on disk), and prints the final
`NEXT_PUBLIC_CDN_BASE` value to set in App Platform.

Pass `--force` to overwrite existing files; default is `--skip-existing`.

### Step 5 — flip the website CDN

In **App Platform → Settings → Env Variables**, add:

```
NEXT_PUBLIC_CDN_BASE=https://happycake-assets.nyc3.cdn.digitaloceanspaces.com
```

Scope: **BUILD_TIME** (Next inlines this at build).

Save, App Platform redeploys, the site now serves images from your bucket.

### Smoke check

```bash
curl -sI https://happycake-assets.nyc3.cdn.digitaloceanspaces.com/products/happy-cake-product-01.webp | head -3
# → HTTP/2 200, content-type: image/webp

curl -s https://happycake.flowleads.dev/ | grep -oE 'https://[^"]*product-01[^"]*' | head -1
# → URL should now have your bucket host, not steppebusinessclub.com
```

---

## Chat attachments — runtime uploads

The chat widget (both the `/chat` page and the floating help-widget) lets
customers attach a photo. The flow:

```
1. User picks a file in the chat widget
2. Browser POSTs multipart/form-data to /api/uploads
3. Backend (src/server.ts) receives, validates, signs to Spaces
4. Spaces returns 200; backend echoes back the public CDN URL
5. Chat widget appends "[image: <url>]" to the next message
6. ChatBubble auto-renders the URL as a thumbnail (existing logic)
7. The agent + the owner's TG bot see the message text including the URL
```

Limits (enforced both client-side and server-side, see
[`src/lib/spaces.ts`](../src/lib/spaces.ts)):

- 10 MB per file
- Allowed MIMEs: `image/{jpeg,jpg,png,webp,gif,heic}`,
  `video/{mp4,webm,quicktime}`
- Files keyed `uploads/threads/<thread_id>/<date>_<random>.<ext>` —
  per-thread directories make it easy to find every photo a customer
  ever sent.

**If the backend's `SPACES_*` env vars are unset**, the upload endpoint
returns `503 { error: "uploads_not_configured" }` and the chat widget
shows a friendly "uploads unavailable" message. Until you set keys,
chat works normally for text — only attachments are gated.

---

## Owner portrait + family photo

After running the migration script, these live on the bucket at:

- `team/owner-askhat.jpg` — about-page hero
- `team/family-couple.jpg` — values section (optional)

If you haven't dropped the binaries into `web/public/assets/team/` yet,
the script logs `MISSING` for them and the about page falls back to its
brand-pattern panel. Once you have the photos:

1. Save them to `web/public/assets/team/owner-askhat.jpg` (etc.)
2. Re-run `bash scripts/migrate-images-to-spaces.sh`
3. They land at `<bucket>/team/<name>.jpg` automatically.

---

## Smoke checks (run after any deploy)

```bash
# 1) Website is up
curl -sI https://happycake.flowleads.dev | head -1
# → HTTP/2 200

# 2) Catalog reaches the backend
curl -s https://happycake.flowleads.dev/api/products | head -c 200
# → { "products": [ { "id": "honey-cake-slice", ... } ] }

# 3) Order draft writes through to SQLite
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

If 2/3/4 return HTML pages instead of JSON, the App-Platform → tunnel hop
is broken. Most likely:

- Tunnel restarted and the URL changed → update `BACKEND_URL` in App
  Platform's dashboard and let it redeploy.
- Backend isn't running on your laptop → `bun src/server.ts` again.
- `BACKEND_URL` value has a stray slash / typo → re-paste from `ngrok status`.

---

## Rolling back

The **website** rolls back via App Platform:

```bash
doctl apps list-deployments <APP_ID>           # shows recent deploys
doctl apps create-deployment <APP_ID>          # rolls forward; pass --force-rebuild for a clean build
# To pin to an old commit: edit .do/app.yaml temporarily to point at a tag,
# then `doctl apps update --spec`.
```

The **backend** is your laptop — `git checkout <sha>` and restart.

Each PR is a single squash commit on `main`, so the rollback target is
always `git log --oneline main^1`.

---

## Future: Tier 2 — Backend on a droplet

Out of scope for the hackathon, kept here so the migration path is documented.

When customer traffic justifies a dedicated host (sustained > 1 req/s, or
when the laptop becomes a flaky single point of failure):

1. Spin up an Ubuntu 22.04 droplet under the `owl` DO project (2 vCPU /
   4 GB is the right starting size — `s-2vcpu-4gb` slug).
2. SSH in, install Bun + Claude Code CLI + clone the repo (same commands
   as the laptop one-time setup above).
3. Front it with Caddy or Nginx for TLS:
   ```caddy
   happycake-api.flowleads.dev {
       reverse_proxy 127.0.0.1:3000
   }
   ```
4. Update `BACKEND_URL` in App Platform's dashboard to the new HTTPS URL.
5. Use [`scripts/sync-backend.sh`](../scripts/sync-backend.sh) for
   subsequent updates: `ssh <droplet> 'cd /opt/sbc-hackathon && bash scripts/sync-backend.sh'`.

The script is already in the repo — it only matters once you migrate.
