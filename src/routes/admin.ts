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
