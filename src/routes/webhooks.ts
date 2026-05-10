// Webhook routes for WA + IG (Meta) and TG.
// Verify endpoints respond to GET; messages arrive on POST.
// Each parser produces zero-or-more IncomingMessages and hands them to onMessage.
//
// Inbound POSTs are HMAC-verified when an App Secret is configured (production).
// Sandbox-injected payloads (from `whatsapp_inject_inbound` etc.) are unsigned;
// we accept them when no App Secret is set, with a one-time warning so the gap
// is visible in logs.

import { Hono } from 'hono'
import type { Context } from 'hono'
import type { MessageHandler } from '../channels/types.ts'
import { config } from '../config.ts'
import { parseWhatsApp } from '../channels/whatsapp.ts'
import { parseInstagram } from '../channels/instagram.ts'
import { verifyMetaSignature } from '../lib/webhook-hmac.ts'

// Log the "no app secret" warning at most once per channel per process.
const warnedNoSecret = new Set<string>()
function warnUnsignedAccepted(channel: string) {
  if (warnedNoSecret.has(channel)) return
  warnedNoSecret.add(channel)
  console.warn(
    `[${channel}] HMAC verification disabled — set ${channel === 'whatsapp' ? 'WA_APP_SECRET' : 'IG_APP_SECRET'} for production`,
  )
}

async function readAndVerify(
  c: Context,
  channel: 'whatsapp' | 'instagram',
  appSecret: string | undefined,
): Promise<{ ok: true; body: unknown } | { ok: false; status: 400 | 401 | 403; message: string }> {
  // Hono consumes the body when you call .json() — we MUST read raw text first
  // so the HMAC is computed on exactly the bytes Meta signed.
  let raw: string
  try {
    raw = await c.req.text()
  } catch {
    return { ok: false, status: 400, message: 'bad body' }
  }
  const sig = c.req.header('x-hub-signature-256')
  const v = verifyMetaSignature(raw, sig, appSecret)
  if (!v.ok) {
    console.warn(`[${channel}] webhook rejected: ${v.reason}`)
    return { ok: false, status: 401, message: 'invalid signature' }
  }
  if (v.reason === 'no_secret') warnUnsignedAccepted(channel)
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return { ok: false, status: 400, message: 'bad json' }
  }
  return { ok: true, body }
}

export function createWebhookRoutes(onMessage: MessageHandler) {
  const r = new Hono()

  // ─── WhatsApp ──────────────────────────────────────────────────────────
  // Meta sends GET to verify the webhook URL once, with hub.challenge.
  r.get('/webhooks/whatsapp', (c) => {
    const mode = c.req.query('hub.mode')
    const token = c.req.query('hub.verify_token')
    const challenge = c.req.query('hub.challenge')
    if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
      console.log('[whatsapp] webhook verified')
      return c.text(challenge ?? '')
    }
    return c.text('forbidden', 403)
  })

  r.post('/webhooks/whatsapp', async (c) => {
    const v = await readAndVerify(c, 'whatsapp', config.whatsapp.appSecret)
    if (!v.ok) return c.text(v.message, v.status)
    const msgs = parseWhatsApp(v.body as Parameters<typeof parseWhatsApp>[0])
    // Ack Meta immediately so they don't retry; process async.
    queueMicrotask(async () => {
      for (const m of msgs) {
        try {
          await onMessage(m)
        } catch (err) {
          console.error('[whatsapp] handler error:', (err as Error).message)
        }
      }
    })
    return c.text('ok')
  })

  // ─── Instagram ─────────────────────────────────────────────────────────
  r.get('/webhooks/instagram', (c) => {
    const mode = c.req.query('hub.mode')
    const token = c.req.query('hub.verify_token')
    const challenge = c.req.query('hub.challenge')
    if (mode === 'subscribe' && token === config.instagram.verifyToken) {
      console.log('[instagram] webhook verified')
      return c.text(challenge ?? '')
    }
    return c.text('forbidden', 403)
  })

  r.post('/webhooks/instagram', async (c) => {
    const v = await readAndVerify(c, 'instagram', config.instagram.appSecret)
    if (!v.ok) return c.text(v.message, v.status)
    const msgs = parseInstagram(v.body as Parameters<typeof parseInstagram>[0], config.instagram.userId)
    queueMicrotask(async () => {
      for (const m of msgs) {
        try {
          await onMessage(m)
        } catch (err) {
          console.error('[instagram] handler error:', (err as Error).message)
        }
      }
    })
    return c.text('ok')
  })

  return r
}
