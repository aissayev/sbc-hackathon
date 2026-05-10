# Website (Next.js 15 on :3001) container.
#
# Build:   docker build -t happycake-web .
# Run:     docker run --env-file .env.local -p 3001:3001 happycake-web
#
# Multi-stage build keeps the runtime image small. The standalone Next.js
# output ships with only what the server needs (no dev deps, no source).

FROM oven/bun:1.1-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1.1-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# BACKEND_URL is needed at build time for SSR'd /admin pages that read from
# the Hono backend. Default to the docker-compose service name; override with
# --build-arg BACKEND_URL=https://api.happycake.us for prod builds.
ARG BACKEND_URL=http://backend:3000
ENV BACKEND_URL=${BACKEND_URL}

RUN bun run build

FROM oven/bun:1.1-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

# Copy only what `next start` needs.
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3001

CMD ["bun", "server.js"]
