// Pre-demo smoke. Drives the three owner-bot demo flows end-to-end against a
// running backend, then prints what to verify in the owner's Telegram chat.
//
//   In one terminal:    bun run dev
//   In another:         bun run demo:smoke              # fast (no LLM, ~5s, $0)
//                       bun run demo:smoke --with-agent # full (LLM, ~30-60s, ~$0.50)
//
// The script doesn't poll Telegram (no Bot API read access from this process).
// It asserts what it can from the DB + HTTP responses, and prints a
// "→ check TG for X" prompt after each successful step.

import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { config } from '../config.ts'
import { listProducts, escalate } from '../domain/tools.ts'
import { postEscalationCard } from '../bots/owner.ts'
import { invokeAgent } from '../agent/invoke.ts'

const BASE = `http://localhost:${config.port}`
const withAgent = process.argv.includes('--with-agent')

interface StepResult {
  ok: boolean
  detail: string
  tgCheck?: string
}
interface Step {
  title: string
  run: () => Promise<StepResult>
}

async function postJson<T>(path: string, body: unknown): Promise<{ status: number; data: T | null }> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = res.ok ? ((await res.json()) as T) : null
    return { status: res.status, data }
  } catch {
    return { status: 0, data: null }
  }
}

async function checkServer(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/`)
    return r.ok
  } catch {
    return false
  }
}

const draftStep: Step = {
  title: 'Customer drafts a whole honey cake',
  run: async () => {
    const products = listProducts({ in_stock_only: false })
    const honey = products.find((p) => p.id === 'whole-honey-cake') ?? products[0]
    if (!honey) return { ok: false, detail: 'no products in catalog — run `bun run db:seed`' }
    const tomorrow4pm = new Date()
    tomorrow4pm.setDate(tomorrow4pm.getDate() + 1)
    tomorrow4pm.setHours(16, 0, 0, 0)
    const r = await postJson<{ order_id: string; total_cents: number; status: string }>(
      '/api/orders/draft',
      {
        thread_id: `smoke_draft_${Date.now()}`,
        channel: 'web',
        items: [{ product_id: honey.id, quantity: 1 }],
        customer_name: 'Smoke Test (Maria)',
        customer_phone: '+12815550100',
        pickup_or_delivery: 'pickup',
        scheduled_at_iso: tomorrow4pm.toISOString(),
        notes: 'demo:smoke — auto-drafted',
      },
    )
    if (r.status !== 200 || !r.data) {
      return { ok: false, detail: `POST /api/orders/draft → ${r.status}` }
    }
    return {
      ok: true,
      detail: `${r.data.order_id} · ${honey.name} · $${(r.data.total_cents / 100).toFixed(2)} · ${r.data.status}`,
      tgCheck: `Owner TG: draft card "${r.data.order_id}" with [✓ Approve] [✗ Reject]. Tap Approve — expect "Square: sq_… · Kitchen: tkt_…" within ~2s.`,
    }
  },
}

const leadStep: Step = {
  title: 'Custom-cake lead with reference photo',
  run: async () => {
    const r = await postJson<{ ok: boolean; lead_id: string }>('/api/leads/custom-cake', {
      contact: '+12815550101',
      name: 'Smoke Test (Olivia)',
      meta: {
        formatted: 'Birthday · 30 servings · 2026-05-23 · pistachio + vanilla',
        reference_photo_urls: [
          'https://www.steppebusinessclub.com/hackathon-assets/happy-cake/products/happy-cake-product-01.webp',
        ],
      },
    })
    if (r.status !== 200 || !r.data?.ok) {
      return { ok: false, detail: `POST /api/leads/custom-cake → ${r.status}` }
    }
    return {
      ok: true,
      detail: `lead ${r.data.lead_id}`,
      tgCheck: `Owner TG: lead card "${r.data.lead_id}" plus an inline photo preview underneath.`,
    }
  },
}

const escStep: Step = {
  title: 'Escalation (severity=medium)',
  run: async () => {
    const threadId = `smoke_esc_${Date.now()}`
    const r = escalate({
      thread_id: threadId,
      channel: 'web',
      reason: 'demo:smoke — synthetic complaint, "cake arrived collapsed, want refund"',
      severity: 'medium',
    })
    if (!r.ok) return { ok: false, detail: 'escalate() returned ok=false' }
    await postEscalationCard(
      r.escalation_id,
      'demo:smoke — synthetic complaint, "cake arrived collapsed, want refund"',
      'medium',
    ).catch((err) => console.error('  postEscalationCard:', (err as Error).message))
    const dedup = (r as { deduplicated?: true }).deduplicated ? ' (deduplicated within 60s)' : ''
    return {
      ok: true,
      detail: `${r.escalation_id}${dedup}`,
      tgCheck: `Owner TG: escalation card "${r.escalation_id}" severity=medium with [👁 View context].`,
    }
  },
}

const agentStep: Step = {
  title: 'Concierge agent — live LLM round-trip',
  run: async () => {
    if (!existsSync('.mcp.json')) {
      return { ok: false, detail: 'missing .mcp.json — run `bun run setup:mcp`' }
    }
    const threadId = `smoke_agent_${Date.now()}`
    const run = await invokeAgent({
      role: 'concierge',
      msg: {
        channel: 'web',
        threadId,
        senderId: threadId,
        senderName: 'Smoke Tester',
        text: 'Hi — do you have a whole honey cake available for tomorrow at 4pm pickup?',
        timestamp: Date.now(),
        raw: {},
      },
      mcpConfigPath: resolve('.mcp.json'),
    })
    const ok = run.exit_code === 0 && run.reply.length > 0 && run.tool_calls.length > 0
    const tools = run.tool_calls.map((t) => t.name.replace('mcp__happycake__', '').replace('mcp__local__', '')).join(', ') || '(none)'
    return {
      ok,
      detail: `${run.tool_calls.length} tools [${tools}] · ${(run.duration_ms / 1000).toFixed(1)}s · $${run.cost_usd?.toFixed(3) ?? '?'}`,
    }
  },
}

const steps: Step[] = withAgent ? [draftStep, leadStep, escStep, agentStep] : [draftStep, leadStep, escStep]

console.log(`\n[demo:smoke] target ${BASE}`)
console.log(`[demo:smoke] mode: ${withAgent ? 'full (with agent)' : 'fast (no LLM)'}`)

if (!(await checkServer())) {
  console.error(`\n✗ Backend not reachable at ${BASE}.`)
  console.error(`  Run \`bun run dev\` in another terminal first.\n`)
  process.exit(1)
}
console.log(`✓ Backend up.\n`)

let pass = 0
let fail = 0
for (const [i, step] of steps.entries()) {
  process.stdout.write(`${i + 1}. ${step.title}… `)
  const t0 = Date.now()
  let result: StepResult
  try {
    result = await step.run()
  } catch (err) {
    result = { ok: false, detail: (err as Error).message }
  }
  const dur = Date.now() - t0
  if (result.ok) {
    pass++
    console.log(`✓ (${dur}ms)`)
    console.log(`   ${result.detail}`)
    if (result.tgCheck) console.log(`   → ${result.tgCheck}`)
  } else {
    fail++
    console.log(`✗ (${dur}ms)`)
    console.log(`   ${result.detail}`)
  }
  console.log()
}

console.log(`Result: ${pass} pass · ${fail} fail`)
if (fail === 0) {
  console.log(`\nLast manual check: in your owner Telegram bot, type a free-text question`)
  console.log(`like "how's the kitchen tomorrow?" — expect 🤔 thinking… → tool calls →`)
  console.log(`final reply with cost footer. That path requires real-user input; the`)
  console.log(`smoke harness can't drive Telegram inbound itself.\n`)
}
process.exit(fail === 0 ? 0 : 1)
