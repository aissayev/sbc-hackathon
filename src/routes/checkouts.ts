// Public heartbeat for the /order checkout funnel. The browser POSTs
// here on every wizard step entry + once on successful submit. The
// only side effect is a row upsert into checkout_sessions; nothing
// blocks the UX. Admin reads (counts + list) live in src/routes/admin.ts.

import { Hono } from 'hono'
import { recordHeartbeat, heartbeatSchema } from '../domain/checkouts.ts'

export const checkoutRoutes = new Hono()

checkoutRoutes.post('/api/checkout/heartbeat', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, reason: 'invalid json' }, 400)
  }
  const parsed = heartbeatSchema.safeParse(body)
  if (!parsed.success) {
    // Don't return 400 with the full Zod tree to a public endpoint;
    // a 204-style "no-op on bad shape" keeps the FE simple — the
    // heartbeat is best-effort. We still log so we notice schema drift.
    console.warn('[checkout/heartbeat] validation failed:', parsed.error.issues[0]?.message)
    return c.json({ ok: false }, 400)
  }
  try {
    const result = recordHeartbeat(parsed.data)
    return c.json(result)
  } catch (err) {
    console.error('[checkout/heartbeat] insert failed:', (err as Error).message)
    return c.json({ ok: false }, 500)
  }
})
