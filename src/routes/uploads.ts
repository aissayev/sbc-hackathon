// Multipart upload endpoint — customer chat attachments + custom-cake
// reference photos + (when enabled) admin marketing uploads.
//
// Callers (web side):
//   - web/src/components/chat/chat-widget.tsx
//   - web/src/components/help-widget/chat-view.tsx
//   - web/src/components/order/custom-cake-funnel.tsx
//
// Storage tiers, picked at request time based on env wiring:
//   PROD  — SPACES_KEY + SPACES_SECRET set → DigitalOcean Spaces
//           (S3-compatible). Files go to <bucket>/uploads/<scope>s/<scope_id>/
//           <file>; the response carries a public CDN URL backed by Spaces'
//           own CDN edge (immutable + cached for a year). Survives backend
//           restarts, scales horizontally, sharable across instances.
//   DEV / HACKATHON — SPACES_* unset → backend local disk at
//           .data/uploads/<key>. The GET handler below serves them at
//           /uploads/<key> so the chat bubble's <img> tag works the same
//           shape as prod. Files DO NOT survive container/droplet
//           replacement and are NOT shared across instances — fine for
//           a single-laptop demo, NOT fine for real production. The boot
//           log warns on this state. See docs/05-deploy/STORAGE.md.
//
// Brand / product / hero / social images don't go through this route —
// those are read-only assets on the hackathon CDN, addressed via
// NEXT_PUBLIC_CDN_BASE in the website. This endpoint is for user-supplied
// content only.
//
// Auth: open to anonymous callers; rate limit is the 10 MB-per-file ceiling
// + the implicit "one request per UI click" cap on the chat. If we ever ship
// admin-only uploads, gate them on the X-Telegram-Init-Data header used by
// /api/admin/*.

import { Hono } from 'hono'
import { mkdirSync, writeFileSync, existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { loadSpacesConfig, uploadToSpaces, buildUploadKey, UPLOAD_LIMITS } from '../lib/spaces.ts'
import { config } from '../config.ts'

export const uploadRoutes = new Hono()

const LOCAL_UPLOAD_ROOT = '.data/uploads'

uploadRoutes.post('/api/uploads', async (c) => {
  let body: FormData
  try {
    body = await c.req.formData()
  } catch {
    return c.json({ error: 'expected multipart/form-data' }, 400)
  }
  const file = body.get('file')
  if (!(file instanceof File)) {
    return c.json({ error: 'missing file field' }, 400)
  }
  if (file.size > UPLOAD_LIMITS.maxBytes) {
    return c.json({ error: 'file too large', max_bytes: UPLOAD_LIMITS.maxBytes }, 413)
  }
  const mime = file.type || 'application/octet-stream'
  if (!UPLOAD_LIMITS.allowedMime.has(mime.toLowerCase())) {
    return c.json({ error: 'unsupported file type', mime }, 415)
  }

  const scopeRaw = (body.get('scope') ?? 'thread').toString()
  const scope: 'thread' | 'order' | 'admin' =
    scopeRaw === 'order' ? 'order' : scopeRaw === 'admin' ? 'admin' : 'thread'
  const scopeId = body.get('scope_id')?.toString()

  const key = buildUploadKey({ scope, scopeId, mimeType: mime })
  const buf = Buffer.from(await file.arrayBuffer())

  const cfg = loadSpacesConfig()
  if (cfg) {
    try {
      const result = await uploadToSpaces(cfg, { key, body: buf, mimeType: mime })
      return c.json({ ok: true, ...result, mime, type: mime, storage: 'spaces' })
    } catch (err) {
      console.error('[uploads] spaces put failed; falling back to local disk', err)
      // Fall through to local disk so the chat doesn't lose the user's file.
    }
  }

  // Local-disk fallback. Resolve the key under .data/uploads, mkdir -p,
  // write the file, return a /uploads/<key> URL that the GET handler
  // below serves with the right Content-Type.
  try {
    const absPath = resolve(LOCAL_UPLOAD_ROOT, key)
    mkdirSync(dirname(absPath), { recursive: true })
    writeFileSync(absPath, buf)
    // buildUploadKey already namespaces under `uploads/...`, and so does
    // our serve route prefix — strip the leading segment so the URL is
    // `/uploads/threads/...` not `/uploads/uploads/threads/...`.
    const urlPath = key.startsWith('uploads/') ? key.slice('uploads/'.length) : key
    const base = (config.publicUrl ?? '').replace(/\/$/, '')
    const url = base ? `${base}/uploads/${urlPath}` : `/uploads/${urlPath}`
    return c.json({ ok: true, key, url, bytes: buf.byteLength, mime, type: mime, storage: 'local' })
  } catch (err) {
    console.error('[uploads] local write failed', err)
    return c.json({ error: 'upload_failed', reason: (err as Error).message }, 502)
  }
})

// Serve files saved by the local-disk fallback. Public-read by design —
// uploaded images are user-supplied and we never put credentials in them.
// In production with Spaces wired, this route is unused since URLs go
// straight to the CDN.
const SERVE_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  gif: 'image/gif', heic: 'image/heic',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
}
uploadRoutes.get('/uploads/*', async (c) => {
  // Strip the `/uploads/` prefix and reject any path-traversal attempt.
  // We save under .data/uploads/uploads/<scope>s/... (key prefix is
  // 'uploads/...'); the URL drops the redundant leading segment, so we
  // re-add it here.
  const raw = c.req.path.replace(/^\/uploads\//, '')
  if (!raw || raw.includes('..') || raw.startsWith('/')) {
    return c.text('not found', 404)
  }
  const absPath = resolve(LOCAL_UPLOAD_ROOT, 'uploads', raw)
  // Defence-in-depth: even after path-traversal rejection above, confirm
  // the resolved absolute path is still under LOCAL_UPLOAD_ROOT.
  const root = resolve(LOCAL_UPLOAD_ROOT)
  if (!absPath.startsWith(root + '/') && absPath !== root) {
    return c.text('not found', 404)
  }
  if (!existsSync(absPath)) return c.text('not found', 404)
  const ext = absPath.split('.').pop()?.toLowerCase() ?? ''
  const mime = SERVE_MIME[ext] ?? 'application/octet-stream'
  const buf = readFileSync(absPath)
  const stat = statSync(absPath)
  return new Response(buf, {
    headers: {
      'Content-Type': mime,
      'Content-Length': String(stat.size),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
})
