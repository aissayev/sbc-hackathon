// Customer-side direct order flow. Two paths converge here:
//
//   1. Standard catalog (slices / whole cakes / pastries): we auto-approve
//      the draft immediately so the kitchen starts on it without waiting
//      for the owner to tap. The customer sees "in the kitchen" on the
//      tracker right away. The owner still gets a TG notification (FYI),
//      not an interactive Approve/Reject card.
//
//   2. Custom designs / catering: drafts land in the owner's TG inbox as
//      an Approve/Reject card — same UX as the agent-drafted path. Askhat
//      eyeballs date/quantity/allergens before the kitchen sees it.
//
// The split is driven by `orderRequiresApproval(items)` (in domain/tools.ts),
// which keys off the product `category`. Source of truth is the seed/MCP
// catalog — no flags scattered across the code.

import { Hono } from 'hono'
import {
  createDraftOrder,
  createDraftOrderSchema,
  getOrderStatus,
  orderRequiresApproval,
} from '../domain/tools.ts'
import { approveDraftAndPromote } from '../domain/order-orchestration.ts'
import { postDraftOrderCard } from '../bots/owner/index.ts'

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

  const requiresApproval = orderRequiresApproval(result.items)
  if (requiresApproval) {
    // Custom / catering — owner approves before the kitchen starts.
    postDraftOrderCard(result.order_id).catch((err) =>
      console.error('[orders/draft] postDraftOrderCard failed:', (err as Error).message),
    )
    return c.json({
      order_id: result.order_id,
      total_cents: result.total_cents,
      status: result.status,
      items: result.items,
      requires_approval: true,
      next_step: 'awaiting_owner_approval',
    })
  }

  // Standard catalog — auto-approve in the background so the response is
  // snappy. We still return the draft id and a status of 'approved' (the
  // promotion is fast: one Square call + one kitchen ticket call) — but
  // we don't block the client on it. The tracker's polling loop will
  // pick up the new status within a few seconds either way.
  void approveDraftAndPromote(result.order_id)
    .then(async (promo) => {
      if (!promo.ok) {
        console.error(
          `[orders/draft] auto-approve failed for ${result.order_id} at ${promo.stage}: ${promo.error}`,
        )
        // Fall back to manual flow so the owner can intervene.
        await postDraftOrderCard(result.order_id).catch(() => {})
      }
    })
    .catch((err) =>
      console.error('[orders/draft] auto-approve threw:', (err as Error).message),
    )

  return c.json({
    order_id: result.order_id,
    total_cents: result.total_cents,
    // Optimistic: client treats it as approved. If promotion later fails
    // the tracker will reflect the corrected status on next poll.
    status: 'approved',
    items: result.items,
    requires_approval: false,
    next_step: 'in_the_kitchen',
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
