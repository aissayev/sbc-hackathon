// Diagnostic: prove (or disprove) the WA outbound visibility bug.
//
// Symptom seen in the owner cockpit:
//   1. agent calls `whatsapp_send` → response says OK
//   2. agent calls `whatsapp_list_threads` → outbound count is 0
//
// We don't know yet whether the sandbox is silently dropping the send,
// dropping the persistence, returning a stale list, or our caller is
// using a wrong arg shape. This script narrows it down.
//
// Run:  bun src/scripts/diag-wa-outbound.ts
//
// What it does:
//   A. snapshot the current thread list
//   B. inject a synthetic INBOUND from the target phone so we have a
//      thread to attach outbound to
//   C. canonical-shape send `{ to, message }` — capture raw RPC response
//   D. wrong-shape send `{ to, text }` — see whether sandbox 4xx's or
//      accepts-and-drops
//   E. small wait + re-list, diff, report
//
// The output answers:
//   - Does the sandbox accept the send? (raw response shape)
//   - Does the wrong-shape send fail loudly or silently?
//   - Does the thread state show outbound after the inbound→outbound
//     round-trip? (this isolates "no thread" from "thread has no
//     outbound counter")
//
// Designed to NOT touch real customer phones: the recipient is a
// sandbox-tracked synthetic number. Default +12815559001.

import { callSandboxTool } from '../lib/sandbox-mcp.ts'

const TARGET = process.env.DIAG_WA_TARGET ?? '+12815559001'
const MARKER = `DIAG-${Date.now().toString(36)}`

interface FlatMessage {
  ts?: string | number
  from?: string
  to?: string
  threadId?: string
  thread_id?: string
  message?: string
  text?: string
  body?: string
}

// The sandbox actually returns `{ inbound, outbound, simulated }` for
// `whatsapp_list_threads`. We also handle the per-thread legacy shape
// `{ threads: [...] }` in case the sandbox flips back.
interface FlatList {
  inbound?: FlatMessage[]
  outbound?: FlatMessage[]
  simulated?: boolean
}
interface ThreadList { threads?: Array<Record<string, unknown>> }

function isFlat(r: unknown): r is FlatList {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return false
  const obj = r as Record<string, unknown>
  return Array.isArray(obj.inbound) || Array.isArray(obj.outbound)
}

function countsForTarget(r: unknown, target: string) {
  const norm = (s: string) => s.replace(/[^\d]/g, '')
  const t = norm(target)
  if (isFlat(r)) {
    const inbound = (r.inbound ?? []).filter((m) => norm(String(m.from ?? '')) === t).length
    const outbound = (r.outbound ?? []).filter((m) => norm(String(m.to ?? '')) === t).length
    return { inbound, outbound, simulated: r.simulated, total_inbound: r.inbound?.length ?? 0, total_outbound: r.outbound?.length ?? 0 }
  }
  if (r && typeof r === 'object' && 'threads' in r) {
    const arr = (r as ThreadList).threads ?? []
    const found = arr.find((row) => {
      const id = (row as { thread_id?: string; threadId?: string; to?: string; phone?: string })
      const v = id.thread_id ?? id.threadId ?? id.to ?? id.phone ?? ''
      return norm(String(v)) === t
    })
    return { inbound: '?', outbound: '?', thread_present: !!found, total_threads: arr.length }
  }
  return { unknown_shape: true }
}

function pretty(label: string, value: unknown) {
  console.log(`${label}: ${JSON.stringify(value)}`)
}

async function safeCall(tool: string, args: Record<string, unknown>) {
  try {
    const out = await callSandboxTool(tool, args)
    return { ok: true, raw: out }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

console.log(`[diag] target = ${TARGET}`)
console.log(`[diag] marker = ${MARKER}`)
console.log()

// ─── A. Snapshot ────────────────────────────────────────────────────
console.log('[A] snapshot whatsapp_list_threads BEFORE any send')
const before = await safeCall('whatsapp_list_threads', {})
if (!before.ok) {
  console.log(`  ✗ list call failed: ${before.error}`)
  process.exit(1)
}
const beforeShape = isFlat(before.raw) ? 'flat {inbound,outbound,simulated}' : 'threads[]'
console.log(`  response shape: ${beforeShape}`)
pretty('  counts for target', countsForTarget(before.raw, TARGET))
console.log()

// ─── B. Inject a synthetic INBOUND so a thread exists ────────────────
console.log('[B] whatsapp_inject_inbound  ← create thread for target')
const inject = await safeCall('whatsapp_inject_inbound', {
  from: TARGET,
  message: `${MARKER} inbound seed`,
})
console.log(`  ok: ${inject.ok}`)
if (inject.ok) {
  console.log(`  raw response: ${JSON.stringify(inject.raw).slice(0, 240)}`)
} else {
  console.log(`  error: ${inject.error}`)
}
console.log()

// ─── C. Canonical send: { to, message } ─────────────────────────────
console.log('[C] whatsapp_send  ← canonical shape { to, message }')
const sendCanon = await safeCall('whatsapp_send', {
  to: TARGET,
  message: `${MARKER} canonical-shape probe`,
})
console.log(`  ok: ${sendCanon.ok}`)
if (sendCanon.ok) {
  console.log(`  raw response: ${JSON.stringify(sendCanon.raw).slice(0, 240)}`)
} else {
  console.log(`  error: ${sendCanon.error}`)
}
console.log()

// ─── D. Wrong-shape send: { to, text } ──────────────────────────────
console.log('[D] whatsapp_send  ← wrong shape { to, text }  (regression probe)')
const sendWrong = await safeCall('whatsapp_send', {
  to: TARGET,
  text: `${MARKER} wrong-shape probe`,
})
console.log(`  ok: ${sendWrong.ok}`)
if (sendWrong.ok) {
  console.log(`  raw response: ${JSON.stringify(sendWrong.raw).slice(0, 240)}`)
} else {
  console.log(`  error: ${sendWrong.error}`)
}
console.log()

// ─── E. Re-list ─────────────────────────────────────────────────────
console.log('[E] re-list AFTER inject + sends')
await new Promise((r) => setTimeout(r, 800))
const after = await safeCall('whatsapp_list_threads', {})
if (!after.ok) {
  console.log(`  ✗ list call failed: ${after.error}`)
  process.exit(1)
}
const afterShape = isFlat(after.raw) ? 'flat {inbound,outbound,simulated}' : 'threads[]'
console.log(`  response shape: ${afterShape}`)
pretty('  counts for target', countsForTarget(after.raw, TARGET))

let sawCanon = false
let sawWrong = false
let sawInbound = false
const norm = (s: string) => s.replace(/[^\d]/g, '')
if (isFlat(after.raw)) {
  const t = norm(TARGET)
  const inForTarget = (after.raw.inbound ?? []).filter((m) => norm(String(m.from ?? '')) === t)
  const outForTarget = (after.raw.outbound ?? []).filter((m) => norm(String(m.to ?? '')) === t)
  if (inForTarget.length || outForTarget.length) {
    console.log('  recent target messages:')
    const recent = [...inForTarget.map((m) => ({ ...m, dir: 'inbound' })), ...outForTarget.map((m) => ({ ...m, dir: 'outbound' }))].slice(-6)
    for (const m of recent) {
      console.log(`    [${m.dir}] ${String(m.message ?? m.text ?? m.body ?? '').slice(0, 80)}`)
    }
  }
  sawInbound = inForTarget.some((m) => String(m.message ?? m.text ?? m.body ?? '').includes(MARKER) && String(m.message ?? m.text ?? m.body ?? '').includes('inbound seed'))
  sawCanon = outForTarget.some((m) => String(m.message ?? m.text ?? m.body ?? '').includes(MARKER) && String(m.message ?? m.text ?? m.body ?? '').includes('canonical'))
  sawWrong = outForTarget.some((m) => String(m.message ?? m.text ?? m.body ?? '').includes(MARKER) && String(m.message ?? m.text ?? m.body ?? '').includes('wrong'))
  console.log()
  console.log(`  marker echo — inbound seed visible:    ${sawInbound}`)
  console.log(`  marker echo — canonical send visible:  ${sawCanon}`)
  console.log(`  marker echo — wrong-shape send visible: ${sawWrong}`)
}
console.log()

// ─── Verdict ────────────────────────────────────────────────────────
console.log('═══ verdict ═══')
const before_t = isFlat(before.raw) ? countsForTarget(before.raw, TARGET) as { outbound?: number } : { outbound: 0 }
const after_t = isFlat(after.raw) ? countsForTarget(after.raw, TARGET) as { outbound?: number } : { outbound: 0 }
const beforeOut = Number(before_t.outbound ?? 0)
const afterOut = Number(after_t.outbound ?? 0)
const outboundDelta = afterOut - beforeOut
const msgDelta = sawCanon ? 1 : 0

console.log(`outbound delta for target: ${outboundDelta}`)
console.log(`canonical-send echo seen:  ${sawCanon}`)

if (sendCanon.ok && (outboundDelta >= 1 || sawCanon)) {
  console.log('• ✓ sandbox accepts canonical send AND persists it. Bug is not in our code.')
} else if (sendCanon.ok && outboundDelta === 0 && !sawCanon) {
  console.log('• ✗ sandbox accepts canonical send but does NOT persist it on the thread.')
  if (typeof sendCanon.raw === 'string' && /simulat/i.test(String(sendCanon.raw))) {
    console.log('  Sandbox is in SIMULATED mode (response: ' + JSON.stringify(sendCanon.raw).slice(0, 80) + ')')
    console.log('  → no real WhatsApp delivery; no persisted outbound on threads.')
    console.log('  → action: route the agent through mcp__local__reply_to_thread so the')
    console.log('    admin Mini App still has a record. Wire Meta WA credentials to')
    console.log('    flip from simulated → real (see docs/05-deploy/LIVE-CHANNELS.md).')
  } else {
    console.log('  → this is a sandbox-side bug or list-endpoint filter issue.')
    console.log('  → action: report sandbox bug; mirror locally as already wired.')
  }
} else if (!sendCanon.ok) {
  console.log('• canonical send call itself failed:')
  console.log(`  ${sendCanon.error}`)
  console.log('  → check SBC_TEAM_TOKEN, SBC_MCP_URL, network.')
}
if (sendWrong.ok && !sendWrong.error) {
  console.log('• ⚠ wrong-shape send returned OK — sandbox silently drops unknown args.')
  console.log('  This means the wa-followup.ts `text:` regression was a real silent failure.')
} else if (!sendWrong.ok) {
  console.log('• ✓ sandbox correctly rejects wrong-shape send: ' + sendWrong.error)
  console.log('  → wrong-shape sends fail loudly; not the silent-drop case.')
}
