# Storage — where files actually live

Two unrelated storage decisions, both pointed at DigitalOcean — but only one of them needs DO **for the hackathon**. This doc captures both so the next agent doesn't have to re-derive the wiring from grep.

## TL;DR

| What | Where (now) | Where (prod) | Decision |
|---|---|---|---|
| Brand / product / hero / social images | hackathon CDN (`steppebusinessclub.com/hackathon-assets/happy-cake/`) | same | Locked. No migration. |
| Customer chat attachments + custom-cake reference photos | backend local disk (`.data/uploads/`) | DO Spaces (`happycake-uploads` bucket) | Flip via env vars. |
| SQLite (orders, threads, escalations, audit) | backend local disk (`.data/happycake.db`) | same droplet + nightly `litestream` to S3 | Out of scope here — see [PRODUCTION.md](./PRODUCTION.md). |

## 1. Read-only brand assets

The hackathon publishes 22 curated files — 3 logos, 4 hero, 10 product photos, 8 social crops — at `https://www.steppebusinessclub.com/hackathon-assets/happy-cake/`. The website's `web/src/lib/brand.ts` references all of them via `NEXT_PUBLIC_CDN_BASE`. The 562 raw source images mentioned in the asset-pack metadata are private and explicitly NOT served (per the metadata's own `rules`).

**We use everything that's available.** No code change can pull more — it's a publishing decision upstream.

If you ever want to migrate these assets onto our own DO Spaces bucket (so the hackathon CDN going dark doesn't break the site), `scripts/migrate-images-to-spaces.sh` is wired and ready: provision the bucket, set `SPACES_*` env, run the script, then flip `NEXT_PUBLIC_CDN_BASE` to the new bucket's CDN endpoint. The folder layout is mirrored intentionally so this is a no-code-change swap. Not required for the hackathon.

## 2. User-supplied uploads — the actual storage decision

`POST /api/uploads` is hit by three surfaces:

- `web/src/components/chat/chat-widget.tsx`
- `web/src/components/help-widget/chat-view.tsx`
- `web/src/components/order/custom-cake-funnel.tsx`

The route ([src/routes/uploads.ts](../../src/routes/uploads.ts)) picks a tier at request time:

```
SPACES_KEY + SPACES_SECRET set ──→ DO Spaces (S3 PUT, returns CDN URL)
either unset                   ──→ .data/uploads/, served via /uploads/*
```

### What "local fallback" actually means

The fallback was built for the hackathon demo: single backend on a laptop, no redeploys, no horizontal scaling. Files DO survive backend `bun --watch` reloads (the directory is on disk, not in memory). They DO NOT survive container replacement, droplet rebuild, or running multiple backend instances. For the 24h build window, that's fine. For a real production system serving real customers, it isn't — a customer photo uploaded today and referenced by an order tomorrow will 404 if the backend container moved overnight.

### Flipping to Spaces

Three steps, ~15 minutes:

```bash
# 1. Create the bucket (separate from the brand-asset bucket — keep prod
#    customer data isolated from the curated-photo bucket).
doctl spaces create happycake-uploads --region nyc3

# 2. Generate an S3-style key scoped to that bucket only:
#    https://cloud.digitalocean.com/account/api/spaces

# 3. Add to the backend's .env.local (NOT the website's — the website
#    proxies /api/uploads through to the backend; only the backend
#    needs the credentials):
SPACES_REGION=nyc3
SPACES_BUCKET=happycake-uploads
SPACES_KEY=...
SPACES_SECRET=...
# Optional overrides:
SPACES_ENDPOINT=https://nyc3.digitaloceanspaces.com
SPACES_CDN_BASE=https://happycake-uploads.nyc3.cdn.digitaloceanspaces.com
```

Restart the backend. Next upload returns `"storage": "spaces"` and a `cdn.digitaloceanspaces.com` URL. To verify mid-flight:

```bash
curl -F "file=@/tmp/test.jpg" -F "scope=thread" -F "scope_id=verify" \
  http://localhost:3000/api/uploads
# {"ok":true, "url":"https://happycake-uploads.nyc3.cdn.digitaloceanspaces.com/uploads/threads/verify/...", "storage":"spaces"}
```

The fallback stays wired even after Spaces is on — if the Spaces PUT throws, the route logs and falls through to local disk so the customer doesn't lose their attachment mid-conversation. The boot log warns when running fallback-only.

### Where this lives in the App Platform spec

Nowhere — and intentionally. `.do/app.yaml` covers only the **website** on App Platform, which doesn't touch Spaces directly (it just proxies `/api/uploads` to the backend). The **backend** runs on a droplet (or laptop via tunnel for the hackathon), and that's where SPACES_* needs to be set. See [PRODUCTION.md](./PRODUCTION.md) for the droplet path.
