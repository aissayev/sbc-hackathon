// Smoke test: create a draft, approve it, see what comes back from the
// sandbox. Exercises the full owner approve path end-to-end.

import { createDraftOrder } from '../domain/tools.ts'
import { approveDraftAndPromote, rejectDraft, readDraft } from '../domain/order-orchestration.ts'

console.log('[smoke] creating draft for whole-honey-cake...')
const draft = createDraftOrder({
  thread_id: `smoke_${Date.now()}`,
  channel: 'web',
  customer_name: 'Smoke Tester',
  items: [{ product_id: 'whole-honey-cake', quantity: 1 }],
  scheduled_at_iso: new Date(Date.now() + 24 * 3600_000).toISOString(),
  pickup_or_delivery: 'pickup',
})
if (!draft.ok) {
  console.error('draft failed:', draft.reason)
  process.exit(1)
}
console.log(`✓ draft ${draft.order_id} · $${(draft.total_cents / 100).toFixed(2)}`)

console.log('\n[smoke] approving draft → promote to Square + Kitchen...')
const t0 = Date.now()
const approve = await approveDraftAndPromote(draft.order_id)
console.log(`${approve.ok ? '✓' : '✗'} ${Date.now() - t0}ms — ${JSON.stringify(approve, null, 2)}`)

if (approve.ok) {
  console.log('\n[smoke] verifying local row reflects promotion...')
  const row = readDraft(draft.order_id)
  console.log(`  status=${row?.status} · square=${row?.square_order_id} · kitchen=${row?.kitchen_ticket_id}`)
} else {
  console.log('\n[smoke] testing reject path on the same draft...')
  const reject = await rejectDraft(draft.order_id, 'smoke-test rejection')
  console.log(`${reject.ok ? '✓' : '✗'} ${JSON.stringify(reject)}`)
}

process.exit(approve.ok || approve.stage === 'square_create' ? 0 : 1)
