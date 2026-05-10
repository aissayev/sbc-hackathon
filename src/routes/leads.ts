// B2B + custom-cake lead capture. Multi-step funnels on the website
// (web/src/components/business/inquire-form, web/src/components/order/custom-cake-funnel)
// submit here. We capture the freeform context as `meta_json` so the owner-side
// TG bot can render it as a review card without us needing a per-source schema.

import { Hono } from 'hono'
import { config } from '../config.ts'
import { createLead, createLeadSchema } from '../domain/tools.ts'

export const leadRoutes = new Hono()

leadRoutes.post('/api/leads/:source', async (c) => {
  const source = c.req.param('source')
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid json' }, 400)
  }
  const parsed = createLeadSchema.safeParse({ ...(body as Record<string, unknown>), source })
  if (!parsed.success) {
    return c.json({ error: 'validation failed', issues: parsed.error.issues }, 400)
  }
  const result = createLead(parsed.data)
  if (result.ok) {
    notifyOwnerOfLead(source, result.lead_id, parsed.data).catch((err) =>
      console.error('[leads] notifyOwnerOfLead failed:', (err as Error).message),
    )
  }
  return c.json({ ...result, next_step: 'awaiting_owner_review' })
})

// Forward a custom-cake / B2B lead to the owner's Telegram chat: a one-line
// summary plus inline previews of any reference_photo_urls the customer
// attached. Best-effort — no-op when the owner-bot env vars aren't set.
async function notifyOwnerOfLead(
  source: string,
  leadId: string,
  payload: { contact: string; meta?: Record<string, unknown> },
): Promise<void> {
  const meta = (payload.meta ?? {}) as Record<string, unknown>
  const photoUrls = Array.isArray(meta.reference_photo_urls)
    ? (meta.reference_photo_urls as unknown[]).filter((u): u is string => typeof u === 'string')
    : []
  const formatted = typeof meta.formatted === 'string' ? meta.formatted : null
  const header = `🎂 New ${source} lead · ${leadId}\n${formatted ?? `Contact: ${payload.contact}`}`
  const { sendTelegram, sendTelegramPhoto } = await import('../channels/telegram.ts')
  const token = config.telegram.owner.token
  const chatId = config.telegram.owner.chatId
  if (!token || !chatId) return
  await sendTelegram(token, chatId, header)
  for (const url of photoUrls) {
    await sendTelegramPhoto(token, chatId, url, `📷 Reference for ${leadId}`)
  }
}
