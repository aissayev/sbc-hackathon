// Webhook routes for WA + IG (Meta) and TG.
// Verify endpoints respond to GET; messages arrive on POST.
// Each parser produces zero-or-more IncomingMessages and hands them to onMessage.

import { Hono } from 'hono'
import type { MessageHandler } from '../channels/types.ts'
import { config } from '../config.ts'
import { parseWhatsApp } from '../channels/whatsapp.ts'
import { parseInstagram } from '../channels/instagram.ts'

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
    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      return c.text('bad json', 400)
    }
    const msgs = parseWhatsApp(body as Parameters<typeof parseWhatsApp>[0])
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
    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      return c.text('bad json', 400)
    }
    const msgs = parseInstagram(body as Parameters<typeof parseInstagram>[0], config.instagram.userId)
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
