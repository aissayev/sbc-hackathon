# Post-hackathon production path (stub)

This is **not the hackathon deploy.** For the 24h build we follow [DEPLOY.md](./DEPLOY.md) Option A (laptop + ngrok), per the brief: *"local execution on the operator's machine."*

## After the event, when this becomes the real Happy Cake system

Path of least resistance:

1. **Dedicated DigitalOcean Droplet** — Ubuntu 22.04, 2 vCPU / 4 GB. Public IP, Caddy in front for TLS.
2. **Install Bun + Claude Code CLI** on the box.
3. **One-time `claude /login`** over an interactive SSH session to populate `~/.claude/.credentials.json` (refresh tokens auto-rotate). Alternative: set `ANTHROPIC_API_KEY` and let Claude Code fall back to API-key auth (cost: pay-per-token instead of subscription).
4. **Containerize**: `Dockerfile` building Bun app + claude binary; `compose.yml` with the SQLite volume + Caddy. (Not implemented yet.)
5. **Named Cloudflare Tunnel** (`cloudflared tunnel create happycake`) — stable hostname, no re-registration of webhooks each restart.
6. **Real WA / IG / Square credentials** swap in for the simulator: change `.mcp.json` to point at the real provider MCPs (or our own thin adapters), rotate `SBC_TEAM_TOKEN` out, rotate WA app secret in.
7. **Backups**: daily `litestream` of SQLite to S3.

When traffic exceeds ~1 req/s sustained, **swap SQLite → Postgres** (Prisma/Drizzle migrations from the existing schema) and add a Redis-backed BullMQ queue between webhook ack and `invokeAgent`. Not before.

Owner: post-hackathon team. Not in the 24h scope.
