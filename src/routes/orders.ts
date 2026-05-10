// Customer-side direct order flow. Drafts land in the owner's TG inbox via
// the same card the agent posts when it calls `create_draft_order` over MCP —
// keeps the human-side experience identical regardless of who drafted it.

import { Hono } from 'hono'
import {
  createDraftOrder,
  createDraftOrderSchema,
  getOrderStatus,
} from '../domain/tools.ts'
import { postDraftOrderCard } from '../bots/owner.ts'

export const orderRoutes = new Hono()

orderRoutes.post('/api/orders/draft', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid json' }, 400)
  }
  const parsed = createDraftOrderSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'validation failed', issues: parsed.error.issues }, 400)
  }
  const result = createDraftOrder(parsed.data)
  if (!result.ok) {
    return c.json(result, 400)
  }
  postDraftOrderCard(result.order_id).catch((err) =>
    console.error('[orders/draft] postDraftOrderCard failed:', (err as Error).message),
  )
  return c.json({
    order_id: result.order_id,
    total_cents: result.total_cents,
    status: result.status,
    items: result.items,
    next_step: 'awaiting_owner_approval',
  })
})

orderRoutes.get('/api/orders/:id', (c) => {
  const id = c.req.param('id')
  const status = getOrderStatus({ order_id: id }) as Record<string, unknown>
  if (status && 'ok' in status && status.ok === false) {
    return c.json(status, 404)
  }
  return c.json(status)
})
