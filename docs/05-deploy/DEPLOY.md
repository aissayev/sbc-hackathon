# Deploy — running `claude -p` on a server

Short answer: **yes, it runs on a server.** Three options, each with tradeoffs.

## What `claude -p` needs anywhere

1. **The binary.** Install Claude Code CLI on the host: `npm install -g @anthropic-ai/claude-code` (or pin the version that matches what we developed against — `2.1.138` at time of writing).
2. **Auth.** Either:
   - **Claude Max session** — interactive `claude` login on the host, OR
   - **`ANTHROPIC_API_KEY`** in env — Claude Code falls back to API key auth automatically.
3. **A subprocess slot per concurrent request.** Spawning `claude -p` costs ~1s cold start + the reasoning duration. For our hackathon traffic (~1 req/s peak), no problem. If we ever hit 50+ concurrent, we'd need to pool or queue.
4. **Network.** Outbound HTTPS to `api.anthropic.com` (Claude API) and `www.steppebusinessclub.com` (sandbox MCP). No inbound special requirements beyond our Hono server's port.

## Option A — Local + ngrok / Cloudflare Tunnel (matches the brief)

The brief says: *"The agent runs as Claude Code CLI on the owner's computer."* So this is the **canonical hackathon deploy.**

```
your laptop (Bun + Hono on :3000) ──► ngrok ──► public URL
                ▲
                │ claude -p uses your Claude Max session
                ▼
   ~/.claude/   (interactive login once)
```

- **Auth:** your Claude Max — no env keys
- **Cost:** counts against your Max plan only; no API spend
- **Pros:** matches brief verbatim; no infra; simplest
- **Cons:** laptop must stay open during eval window; tunnel URL changes if ngrok restarts (free tier)
- **Demo path:** start `bun run dev`, start `ngrok http 3000`, paste URL into `whatsapp_register_webhook` and `instagram_register_webhook` once

This is what we'll use for the demo. Already what `bun run dev` does today.

## Option B — DigitalOcean Apps (or similar PaaS)

For the customer-facing **website** (Next.js in `web/`), this is great. The website doesn't run `claude -p` — it just hits the backend over HTTP. So a standard Node/Bun deploy works.

For the **backend** (Hono + claude -p), Apps platforms are workable but you have to:

1. Add `claude` to the buildpack: `npm install -g @anthropic-ai/claude-code` in build phase
2. Set `ANTHROPIC_API_KEY` as an App env secret (you can't run interactive Claude Max login on a managed host)
3. Set `SBC_TEAM_TOKEN`, `WA_TOKEN`, `IG_TOKEN`, etc. as secrets
4. Note: **API key spend is billed to whoever owns the key.** No free Anthropic credits per the brief.

Why you might still do this: it gives you a stable public URL for webhook registration (no ngrok needed), and the backend can keep running while you sleep.

## Option C — DigitalOcean Droplet (full VM)

The most flexible. Spin up a Droplet, SSH in, install bun + claude, clone the repo, run as a systemd service. Same auth options as Apps (Claude Max via interactive `claude` login, OR `ANTHROPIC_API_KEY` env).

```bash
# on the droplet
curl -fsSL https://bun.sh/install | bash
npm install -g @anthropic-ai/claude-code
git clone git@github.com:aissayev/sbc-hackathon.git
cd sbc-hackathon
bun install
cp .env.example .env.local
# edit .env.local: SBC_TEAM_TOKEN, ANTHROPIC_API_KEY (or run `claude` once interactively)
bun run setup:mcp
bun run db:seed
# run as systemd service:
sudo cat > /etc/systemd/system/happycake.service <<EOF
[Service]
WorkingDirectory=/root/sbc-hackathon
ExecStart=/root/.bun/bin/bun src/server.ts
Restart=always
EOF
sudo systemctl enable --now happycake
```

Add Caddy or nginx in front for TLS termination → public URL → use that for webhook registration.

## Recommended deploy for this hackathon

1. **Backend on your laptop + ngrok.** Matches the brief's "owner's computer" pattern. Auth = your Claude Max. No infra cost. Demo from there.
2. **Website on DigitalOcean Apps** with `NEXT_PUBLIC_BACKEND_URL=https://<your-ngrok>.ngrok-free.app`. Public, fast, doesn't need claude.
3. **Submission documents** point to both URLs.

If your laptop must close (sleep/travel) before submission, fall back to **Option C with `ANTHROPIC_API_KEY`** for the backend so it keeps running headless. Cost: maybe $5–15 of Anthropic API spend during eval window (~6h of judging).

## Production-grade considerations (post-hackathon)

When this becomes the real thing:

- **Persist with the same `claude -p` subprocess pattern** — works in production with a small concurrency cap. (Agent SDK is banned for this hackathon; post-hackathon you may evaluate it, but the subprocess pattern handles ~10 req/s fine.)
- **Add a job queue** (Redis + BullMQ or similar) for slow operations (campaign metric refresh, daily digest)
- **Horizontal scale** — stateless Hono server behind a load balancer; SQLite becomes the bottleneck → swap to Postgres
- **Observability** — structured logs from `agent_invocations` to a real log store; tracing per `claude -p` call

None of that is hackathon-relevant.
