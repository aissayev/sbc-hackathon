// Multipart upload endpoint for chat attachments + admin photos. Files land
// in `<bucket>/uploads/<scope>s/<scope_id>/<date>_<random>.<ext>` and the
// response carries a public CDN URL the chat bubble renders via the existing
// `[image: <url>]` markers.
//
// Auth: open to anonymous callers; rate limit is the 10 MB-per-file ceiling
// + the implicit "one request per UI click" cap on the chat. If we ever ship
// admin-only uploads, gate them on the X-Telegram-Init-Data header used by
// /api/admin/*.

import { Hono } from 'hono'
import { loadSpacesConfig, uploadToSpaces, buildUploadKey, UPLOAD_LIMITS } from '../lib/spaces.ts'

export const uploadRoutes = new Hono()

uploadRoutes.post('/api/uploads', async (c) => {
  const cfg = loadSpacesConfig()
  if (!cfg) {
    return c.json(
      { error: 'uploads_not_configured', reason: 'SPACES_* env vars are unset on the backend.' },
      503,
    )
  }

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
  try {
    const result = await uploadToSpaces(cfg, { key, body: buf, mimeType: mime })
    return c.json({ ok: true, ...result, mime, type: mime })
  } catch (err) {
    console.error('[uploads] put failed', err)
    return c.json({ error: 'upload_failed', reason: (err as Error).message }, 502)
  }
})
