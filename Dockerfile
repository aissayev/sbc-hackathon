# Backend (Hono + Bun on :3000) container.
#
# Build:   docker build -t happycake-backend .
# Run:     docker run --env-file .env.local -p 3000:3000 \
#                 -v "$PWD/.data:/app/.data" \
#                 -v "$PWD/.mcp.json:/app/.mcp.json:ro" \
#                 happycake-backend
#
# Notes:
#  - Mount .data/ as a volume so SQLite persists across container restarts.
#  - Mount .mcp.json read-only after rendering it from .mcp.json.template
#    locally with `bun run setup:mcp` (the template references env vars the
#    container can't access at build time).
#  - claude -p is NOT inside the container. The agent runtime expects the
#    Claude Code CLI on PATH; the container is the bot wrapper / HTTP server,
#    not the model. For container-based deploys, run `claude` on the host
#    and map the binary in (volume), or run the wrapper outside Docker.

FROM oven/bun:1.1-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1.1-alpine AS runtime
WORKDIR /app

# Install runtime deps + create the .data dir for SQLite.
COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock tsconfig.json ./
COPY src ./src
COPY data ./data

RUN mkdir -p .data

EXPOSE 3000

# .env.local is provided at runtime via --env-file, never baked into the image.
# .mcp.json is mounted read-only at runtime, never committed or baked.
ENV NODE_ENV=production

CMD ["bun", "src/server.ts"]
