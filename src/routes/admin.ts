// Owner admin API — powers /admin/* on the website.
//
// ⚠️ HACKATHON-MODE OPEN ACCESS:
// These routes are intentionally unauthenticated for the build window. The
// admin pages are owner-facing per the brief ("owner UI is Telegram only" is
// the agent constraint; the website's /admin/* is a Mini-App-style surface
// for the owner). For any public deploy, gate behind cookie auth or the
// X-Telegram-Init-Data header (Mini App pattern).

import { Hono } from 'hono'
import {
  dailyReport,
  listOrders,
  listEscalations,
  getOrderStatus,
} from '../domain/tools.ts'
import { approveDraftAndPromote, rejectDraft } from '../domain/order-orchestration.ts'
import {
  listInboxThreads,
  getInboxThread,
  replyToInboxThread,
} from '../domain/inbox.ts'
import {
  listChannelStatuses,
  getChannelStatus,
  registerChannelWebhook,
  sendTestInbound,
  type ChannelId,
} from '../domain/channels.ts'

export const adminRoutes = new Hono()

adminRoutes.get('/api/admin/today', (c) => c.json(dailyReport()))

adminRoutes.get('/api/admin/orders', (c) => {
  const status = c.req.query('status') ?? undefined
  return c.json({ orders: listOrders({ status }) })
})

adminRoutes.get('/api/admin/orders/:id', (c) => {
  const id = c.req.param('id')
  const status = getOrderStatus({ order_id: id }) as Record<string, unknown>
  if (status && 'ok' in status && status.ok === false) return c.json(status, 404)
  return c.json(status)
})

adminRoutes.get('/api/admin/escalations', (c) => {
  const status = c.req.query('status') ?? undefined
  return c.json({ escalations: listEscalations({ status }) })
})

adminRoutes.post('/api/admin/orders/:id/approve', async (c) => {
  const id = c.req.param('id')
  const result = await approveDraftAndPromote(id)
  return c.json(result, result.ok ? 200 : 400)
})

adminRoutes.post('/api/admin/orders/:id/reject', async (c) => {
  const id = c.req.param('id')
  let body: { reason?: string } = {}
  try {
    body = (await c.req.json()) as { reason?: string }
  } catch {}
  const reason = (body.reason ?? '').trim() || 'Owner declined via admin'
  const result = await rejectDraft(id, reason)
  return c.json(result, result.ok ? 200 : 400)
})

// Unified inbox — WhatsApp + Instagram + website chat in one feed.
// Filter via ?channel=whatsapp|instagram|web|all (default all)
// and ?bucket=new|all|mine (default all).
adminRoutes.get('/api/admin/threads', async (c) => {
  const channel = (c.req.query('channel') ?? 'all') as
    | 'all' | 'whatsapp' | 'instagram' | 'web'
  const bucket = (c.req.query('bucket') ?? 'all') as 'all' | 'new' | 'mine'
  const result = await listInboxThreads({ channel, bucket })
  return c.json(result)
})

adminRoutes.get('/api/admin/threads/:channel/:id', async (c) => {
  const channel = c.req.param('channel') as 'whatsapp' | 'instagram' | 'web'
  const id = decodeURIComponent(c.req.param('id'))
  const thread = await getInboxThread(channel, id)
  if (!thread) return c.json({ ok: false, error: 'thread_not_found' }, 404)
  return c.json(thread)
})

adminRoutes.get('/api/admin/channels', async (c) => {
  const channels = await listChannelStatuses()
  return c.json({ channels })
})

adminRoutes.get('/api/admin/channels/:id', async (c) => {
  const id = c.req.param('id') as ChannelId
  const channel = await getChannelStatus(id)
  if (!channel) return c.json({ ok: false, error: 'unknown_channel' }, 404)
  return c.json(channel)
})

adminRoutes.post('/api/admin/channels/:id/register', async (c) => {
  const id = c.req.param('id') as ChannelId
  const result = await registerChannelWebhook(id)
  return c.json(result, result.ok ? 200 : 400)
})

adminRoutes.post('/api/admin/channels/:id/test', async (c) => {
  const id = c.req.param('id') as ChannelId
  const result = await sendTestInbound(id)
  return c.json(result, result.ok ? 200 : 400)
})

adminRoutes.post('/api/admin/threads/:channel/:id/reply', async (c) => {
  const channel = c.req.param('channel') as 'whatsapp' | 'instagram' | 'web'
  const id = decodeURIComponent(c.req.param('id'))
  let body: { text?: string } = {}
  try {
    body = (await c.req.json()) as { text?: string }
  } catch {}
  const text = (body.text ?? '').trim()
  if (!text) return c.json({ ok: false, error: 'empty_message' }, 400)
  const result = await replyToInboxThread(channel, id, text)
  return c.json(result, result.ok ? 200 : 400)
})
