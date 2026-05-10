# Docker deployment

How to run the HappyCake stack in containers — local-dev parity, single-host VPS deploy, or as a starting point for Kubernetes / ECS.

---

## What's in the box

```
.
├── Dockerfile             ← backend (Bun + Hono on :3000)
├── docker-compose.yml     ← runs backend + web together
└── web/Dockerfile         ← Next.js 15 standalone build on :3001
```

Three artifacts, two services, one network. Reverse-proxy is intentionally not bundled — see [Reverse-proxy with Caddy](#reverse-proxy-with-caddy) below.

---

## What's NOT in the container (and why)

**`claude -p` is not inside the image.** The Claude Code CLI runs the agent reasoning loop. Per the hackathon brief, the runtime is the operator's local Claude Code install with their own Claude Max subscription — we don't ship Claude inside our container. For container-based deploys, two patterns:

1. **Sidecar:** mount the host's `claude` binary into the container (`-v $(which claude):/usr/local/bin/claude:ro`).
2. **Bot wrapper outside, Claude on host:** run the bot wrapper (this container) connected to a local agent runner that the operator's machine is already running.

For a hackathon submission demo, run the wrapper and Claude on the same laptop — the container is for *post-hackathon* deployment when you move from "operator's MacBook" to "VPS + tunnel".

**Real Meta credentials (WA / IG)** are also not baked into the image. They live in `.env.local`, mounted via `--env-file` at runtime.

---

## Quick start (local dev)

```bash
# 1. Render the MCP config from template (substitutes SBC_TEAM_TOKEN from .env.local)
bun run setup:mcp

# 2. Build + run both services
docker compose up --build

# 3. In another terminal — verify
curl http://localhost:3000/api/products | jq '.products | length'   # → 10
curl http://localhost:3001/                                          # → HappyCake homepage HTML

# 4. Tail logs
docker compose logs -f backend
```

The first build takes ~2 min; subsequent builds reuse layers and finish in ~10 sec for code-only changes.

---

## Single-host VPS deploy

Provision any small VPS (DigitalOcean Droplet $12/mo, Hetzner CX22 €6/mo). Install Docker. Then:

```bash
# On the VPS
git clone https://github.com/aissayev/sbc-hackathon
cd sbc-hackathon

# Copy your .env.local + render the MCP config
cp /path/to/your/.env.local .env.local
bun run setup:mcp

# Boot
docker compose up -d --build
```

Two services run on `:3000` and `:3001`. Bind a public reverse-proxy (Caddy is the smallest option) to issue Let's Encrypt certs and route the public hostname to the right service.

---

## Reverse-proxy with Caddy

Caddy auto-issues TLS via Let's Encrypt and the config is two lines per host. Place this `Caddyfile` next to `docker-compose.yml`:

```caddyfile
happycake.us {
  reverse_proxy web:3001
}

api.happycake.us {
  reverse_proxy backend:3000
}
```

Add Caddy to `docker-compose.yml`:

```yaml
  caddy:
    image: caddy:2-alpine
    container_name: happycake-caddy
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config
    depends_on: [backend, web]
    restart: unless-stopped

volumes:
  caddy-data:
  caddy-config:
```

Now your public URLs are `https://happycake.us` and `https://api.happycake.us` with auto-renewing TLS certs.

---

## Webhooks via tunnel vs public URL

The hackathon brief explicitly approves *"ngrok or Cloudflare Tunnel for inbound webhooks"* as the laptop deployment pattern. Both work fine for the hackathon demo. The tradeoff:

| Path | Pros | Cons |
|---|---|---|
| **ngrok** (`ngrok http 3000`) | Zero config, works in 30 seconds, brief-approved | URL changes each restart, free tier sleeps after 8h, not for production |
| **Cloudflare Tunnel** (`cloudflared tunnel run`) | Stable named URL, free tier durable, brief-approved | Needs DNS setup (one-time, 5 min) |
| **Public host + Caddy** (above) | Production-grade, no tunnel | Costs $6–12/mo, requires VPS |

**For submission:** ngrok is the recommended path. After the hackathon, migrate to Cloudflare Tunnel for stable demo URLs, then to a real VPS + Caddy when you have customers.

---

## Limitations and assumptions

The Docker setup is honest about what it does and doesn't cover. Things to know:

1. **claude binary is on the host, not in the container.** See "What's NOT in the container" above. Don't try to `apt-get install claude` — the CLI ships only via the official installer and binds to a Claude Max subscription, which lives on the operator's machine.

2. **SQLite is the only persistence.** No Postgres, no Redis. The `.data` volume is the entire database. Backups = `cp .data/happycake.db backup-$(date +%F).db`. Migrating to Postgres post-hackathon is a documented next step ([docs/05-deploy/PRODUCTION.md](./PRODUCTION.md)).

3. **Single-tenant.** The container assumes one team token, one set of bot tokens, one bakery. Multi-tenancy is not in scope for the hackathon brief.

4. **Health checks are basic.** `docker compose` has no built-in health probe; for prod, add a readiness probe via Caddy or a dedicated `/health` endpoint loop.

5. **Secrets management is `.env.local`.** No Docker secrets, no Vault, no KMS. Fine for a single VPS; needs hardening for any multi-host or shared environment.

6. **Hackathon submission deploy:** the recommended demo path stays *"laptop + ngrok"* per the brief. The Docker artifacts are here for the *production-readiness rubric line* and for the post-hackathon "the system you ship goes live the week after" promise.
