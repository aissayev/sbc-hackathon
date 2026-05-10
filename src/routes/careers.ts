// Customer-side careers application flow.
//
//   POST /api/careers/apply
//     Validates a Zod schema (see domain/applications.ts), inserts a row,
//     fires the owner TG card asynchronously, and returns the new
//     application id. No auth — anyone on the public site can submit.
//
// Admin-side endpoints live in src/routes/admin.ts (list + status update)
// because they ride the same `/api/admin/*` auth fence as everything else
// on the cockpit.

import { Hono } from 'hono'
import { createApplication, createApplicationSchema } from '../domain/applications.ts'
import { postApplicationCard } from '../bots/owner/index.ts'

export const careerRoutes = new Hono()

careerRoutes.post('/api/careers/apply', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, reason: 'invalid json' }, 400)
  }
  const parsed = createApplicationSchema.safeParse(body)
  if (!parsed.success) {
    // Surface the first issue's path + message — readable in the UI without
    // exposing the full Zod tree. Browser-side validation should catch most
    // of these; this is the safety net for someone hitting curl.
    const first = parsed.error.issues[0]
    const path = first?.path?.join('.') ?? ''
    return c.json(
      {
        ok: false,
        reason: path ? `${path}: ${first.message}` : (first?.message ?? 'validation failed'),
        issues: parsed.error.issues,
      },
      400,
    )
  }

  const result = createApplication(parsed.data)
  if (!result.ok) {
    return c.json(result, 400)
  }

  // Fire-and-forget owner notification. No-op when the bot isn't configured;
  // never blocks the customer's response.
  postApplicationCard(result.application_id).catch((err) =>
    console.error('[careers/apply] postApplicationCard failed:', (err as Error).message),
  )

  return c.json({
    ok: true,
    application_id: result.application_id,
    next_step: 'awaiting_owner_review',
  })
})
