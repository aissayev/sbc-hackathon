# Happy Cake website — deploy notes

The website lives at `https://happycake.flowleads.dev/` on a DigitalOcean
droplet, fronted by Caddy / nginx, running the Next.js standalone build.

## Required environment variables

Set these in the droplet's process environment (systemd unit, PM2 ecosystem
file, or whatever supervisor you're using). Without `BACKEND_URL` the order
flow and chat will both surface a friendly "kitchen system offline" error
because Next's rewrites silently fall back to `http://localhost:3000` and the
proxy returns HTML instead of JSON.

| Variable | Required | Example | Notes |
|---|---|---|---|
| `BACKEND_URL` | **yes** | `https://your-ngrok.ngrok-free.app` or `http://127.0.0.1:3000` | Where the Hono backend (`bun src/server.ts`) is reachable from the Next process. |
| `NEXT_PUBLIC_BACKEND_URL` | optional | same as above | Browser-side fallback if you ever need the client to hit the backend directly (we don't today — everything proxies through Next). |
| `NEXT_PUBLIC_SITE_URL` | optional | `https://happycake.flowleads.dev` | Used in JSON-LD `@id` URLs and OpenGraph. Defaults to the live host. |
| `NODE_ENV` | yes | `production` | Standard Next setting. |

The Hono backend (`src/server.ts`) reads its own envs from `.env` —
`PORT`, `CLAUDE_*`, `TELEGRAM_*`, etc. — and is not the same process as the
Next site. Both must be running.

## Standalone build

```bash
cd web
bun install
bun run build              # → .next/standalone/

# Static + public assets aren't auto-copied; the standalone runner needs them:
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/

# Run
BACKEND_URL=http://127.0.0.1:3000 \
NODE_ENV=production \
node .next/standalone/server.js
```

## Owner portrait + family photo (optional, recommended)

The `/about` page references two local images that are **not** on the public
CDN:

- `web/public/assets/team/owner-askhat.jpg` — used as the about-page hero
- `web/public/assets/team/family-couple.jpg` — used inline in the values
  section (currently optional)

Drop the binary files at those paths before building. The
[`HeroImage`](src/components/brand/hero-image.tsx) component falls back to a
brand-pattern panel if the file 404s, so the page never breaks — but the page
reads better with the real photo.

## Local DB seed (backend)

When the backend's SQLite is fresh, seed it with the canonical catalog:

```bash
cd /path/to/sbc-hackathon
bun src/scripts/db-init.ts --seed
# → seeded 10 products
```

The seed mirrors `web/src/lib/catalog.ts` exactly, so the backend's
`/api/products`, the website's `/menu`, and the agent's
`square_list_catalog` MCP tool all describe the same products with the same
photo URLs.

## Smoke checks after deploy

```bash
curl -s https://happycake.flowleads.dev/api/products | head -c 200
# → { "products": [ { "id": "honey-cake-slice", ... } ] }

curl -s -X POST https://happycake.flowleads.dev/api/orders/draft \
  -H 'Content-Type: application/json' \
  -d '{"thread_id":"smoke","channel":"web","items":[{"product_id":"honey-cake-slice","quantity":1}]}'
# → { "order_id": "ord_...", "total_cents": 850, ... }

curl -s -X POST https://happycake.flowleads.dev/api/leads/b2b \
  -H 'Content-Type: application/json' \
  -d '{"contact":"smoke@test","meta":{"company":"Test"}}'
# → { "ok": true, "lead_id": "lead_...", "next_step": "awaiting_owner_review" }

curl -s https://happycake.flowleads.dev/llms.txt | head -10
# → starts with "# Happy Cake — agent-readable surface"
```

If any of those return HTML (status 404 / 500 page), `BACKEND_URL` is wrong
or the backend process isn't running. Check the Next logs and the Hono logs.

## Caddy / nginx note

If you're proxying `https://happycake.flowleads.dev` to the Next port (3000
by default), make sure you also proxy `/api/*` through the same upstream —
the Next rewrites handle the backend hop themselves; the reverse proxy just
needs to pass everything through.

## Rolling back

```bash
git log --oneline main -10        # find the prior good SHA
git checkout <sha>
bun install
bun run build
# restart the supervisor
```

Each PR is a single squash commit on main, so the rollback target is
always `git log --oneline main^1`.
