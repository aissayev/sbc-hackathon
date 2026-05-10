#!/usr/bin/env bash
# Migrate Happy Cake brand assets from the hackathon CDN to your own
# DigitalOcean Spaces bucket.
#
# Prereqs:
#   1. Create the bucket:
#        doctl spaces create happycake-assets --region nyc3
#   2. Generate Spaces access keys at
#        https://cloud.digitalocean.com/account/api/spaces
#      and put them in .env.local:
#        SPACES_REGION=nyc3
#        SPACES_BUCKET=happycake-assets
#        SPACES_KEY=...
#        SPACES_SECRET=...
#   3. Install s3cmd (matches Spaces' S3 API better than awscli for this):
#        brew install s3cmd
#
# Run:
#   bash scripts/migrate-images-to-spaces.sh
#
# Safe to re-run: --skip-existing means we won't re-upload files that are
# already in the bucket. Pass --force as the first argument to overwrite.

set -euo pipefail

cd "$(dirname "$0")/.."

# ─── Load .env.local ─────────────────────────────────────────────────────
if [[ -f .env.local ]]; then
  # shellcheck disable=SC1091
  set -a; source .env.local; set +a
elif [[ -f .env ]]; then
  set -a; source .env; set +a
fi

: "${SPACES_REGION:?SPACES_REGION required (e.g. nyc3)}"
: "${SPACES_BUCKET:?SPACES_BUCKET required (e.g. happycake-assets)}"
: "${SPACES_KEY:?SPACES_KEY required}"
: "${SPACES_SECRET:?SPACES_SECRET required}"

ENDPOINT="${SPACES_ENDPOINT:-https://${SPACES_REGION}.digitaloceanspaces.com}"
HOST="${SPACES_REGION}.digitaloceanspaces.com"
SOURCE_CDN="https://www.steppebusinessclub.com/hackathon-assets/happy-cake"

echo "==> migrating $SOURCE_CDN  ->  ${ENDPOINT}/${SPACES_BUCKET}/"

# Force-overwrite mode (default off — re-runs are no-ops).
SYNC_FLAG="--skip-existing"
if [[ "${1:-}" == "--force" ]]; then
  echo "==> --force: existing files will be overwritten"
  SYNC_FLAG=""
fi

# ─── Verify s3cmd is configured ──────────────────────────────────────────
if ! command -v s3cmd >/dev/null 2>&1; then
  echo "ERROR: s3cmd not installed. brew install s3cmd" >&2
  exit 1
fi

# Drop a one-shot s3cmd config file (removed on exit, never on disk).
S3CFG="$(mktemp -t s3cmd-spaces.XXXXXX)"
STAGE="$(mktemp -d -t hc-migrate.XXXXXX)"
trap 'rm -f "$S3CFG"; rm -rf "$STAGE"' EXIT

cat > "$S3CFG" <<EOF
[default]
host_base = ${HOST}
host_bucket = %(bucket)s.${HOST}
access_key = ${SPACES_KEY}
secret_key = ${SPACES_SECRET}
use_https = True
signature_v2 = False
EOF

# ─── Pull files from hackathon CDN to a local staging dir ────────────────
# Asset inventory mirrors web/src/lib/brand.ts ASSETS layout exactly so the
# env-driven CDN swap is a no-code-change flip.
download() {
  local rel="$1"
  local url="${SOURCE_CDN}/${rel}"
  local dest="${STAGE}/${rel}"
  mkdir -p "$(dirname "$dest")"
  if curl -sf -o "$dest" "$url"; then
    echo "  pulled  $rel"
  else
    echo "  MISSING $rel  (skipping)"
    rm -f "$dest"
    return 0
  fi
}

echo "==> pulling brand + product photos to $STAGE"
download "logo/happy-cake-logo-256.png"
download "logo/happy-cake-logo-512.png"
download "logo/happy-cake-logo-1024.png"
for i in 01 02 03 04; do
  download "hero/happy-cake-hero-${i}.webp"
done
for i in 01 02 03 04 05 06 07 08 09 10; do
  download "products/happy-cake-product-${i}.webp"
done
for i in 01 02 03 04 05 06 07 08; do
  download "social/happy-cake-social-${i}.webp"
done

# Optional locally-sourced photos. Won't fail if they aren't on disk.
if [[ -f web/public/assets/team/owner-askhat.jpg ]]; then
  mkdir -p "$STAGE/team"
  cp web/public/assets/team/owner-askhat.jpg "$STAGE/team/owner-askhat.jpg"
  echo "  staged  team/owner-askhat.jpg (from web/public/)"
fi
if [[ -f web/public/assets/team/family-couple.jpg ]]; then
  mkdir -p "$STAGE/team"
  cp web/public/assets/team/family-couple.jpg "$STAGE/team/family-couple.jpg"
  echo "  staged  team/family-couple.jpg (from web/public/)"
fi

# ─── Push to Spaces with public-read ACL ─────────────────────────────────
echo "==> uploading to s3://${SPACES_BUCKET}/"
s3cmd sync \
  --config="$S3CFG" \
  --acl-public \
  --no-mime-magic \
  --guess-mime-type \
  --add-header="Cache-Control: public, max-age=31536000, immutable" \
  $SYNC_FLAG \
  "$STAGE/" "s3://${SPACES_BUCKET}/"

echo ""
echo "==> done."
echo ""
echo "Set the website to point at the new CDN:"
echo "  NEXT_PUBLIC_CDN_BASE=${SPACES_CDN_BASE:-https://${SPACES_BUCKET}.${SPACES_REGION}.cdn.digitaloceanspaces.com}"
echo ""
echo "Add that to App Platform -> Settings -> Env Variables (BUILD_TIME scope),"
echo "then redeploy. The site will start serving images from your bucket."
