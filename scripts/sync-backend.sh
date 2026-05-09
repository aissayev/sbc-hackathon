#!/usr/bin/env bash
# Run this ON the droplet to pull, install, and re-seed the backend.
# Restart the supervisor (systemd / pm2) yourself afterwards — that part
# depends on how each droplet runs the Hono server.
#
# Usage (on the droplet):
#   cd /path/to/sbc-hackathon
#   bash scripts/sync-backend.sh
#
# Or remotely from your laptop (uses SSH config aliases like `flowleads-us`):
#   ssh flowleads-us 'cd /opt/sbc-hackathon && bash scripts/sync-backend.sh'

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

echo "==> sync-backend on $(hostname) — repo at $ROOT"

# 1. Stash any uncommitted local edits so we never lose work on a fast-pull.
#    Re-apply at the end (best-effort; conflicts are reported but not fatal).
HAD_LOCAL_CHANGES=0
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "==> stashing local changes"
  git stash push -u -m "sync-backend-$(date +%s)" >/dev/null
  HAD_LOCAL_CHANGES=1
fi

echo "==> git pull --ff-only origin main"
git fetch origin main --quiet
git checkout main --quiet
git pull --ff-only --quiet

echo "==> bun install"
bun install --silent

echo "==> bun src/scripts/db-init.ts --seed"
bun src/scripts/db-init.ts --seed

if [[ "$HAD_LOCAL_CHANGES" -eq 1 ]]; then
  echo "==> restoring stashed local changes"
  git stash pop || echo "WARN: stash pop reported conflicts — resolve manually"
fi

echo "==> done. Restart the supervisor:"
echo "    systemctl restart happycake-backend"
echo "  OR"
echo "    pm2 restart happycake-backend"
