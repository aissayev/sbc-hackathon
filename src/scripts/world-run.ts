// World scenario consumer.
// Starts (or resumes) a sandbox scenario and pumps events through our pipeline:
//   1. Loops `world_next_event` until status != 'delivered' (no more events).
//   2. For each event, builds an IncomingMessage and runs the same onMessage
//      path that webhooks use — claude -p invocation + reply via channel
//      adapter (which in 'both' mode hits sandbox MCP for scoring).
//   3. Prints a per-event summary + final scenario summary.
//
// Usage:
//   bun run world:run                              # default scenario
//   bun run world:run weekend-capacity-crunch      # specific scenario
//   bun run world:run --max=5                      # cap event count

import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { invokeAgent, recordRun } from '../agent/invoke.ts'
import { pickRole } from '../agent/router.ts'
import { whatsappAdapter } from '../channels/whatsapp.ts'
import { instagramAdapter } from '../channels/instagram.ts'
import { webAdapter } from '../channels/web.ts'
import { telegramAdapter } from '../channels/telegram.ts'
import { callSandboxTool, tryCallSandboxTool } from '../lib/sandbox-mcp.ts'
import type { ChannelAdapter, IncomingMessage } from '../channels/types.ts'

interface WorldEvent {
  id: string
  scenarioId: string
  minute: number
  channel: 'whatsapp' | 'instagram' | 'google_business' | 'kitchen' | 'owner' | 'system'
  type: string
  priority: 'high' | 'normal' | 'low'
  payload: Record<string, unknown>
  deliveredAt: string
}

interface NextEventResponse {
  status: 'delivered' | 'idle' | 'finished'
  event?: WorldEvent
  run?: { scenarioId?: string; name?: string }
}

const args = process.argv.slice(2)
const scenarioId = args.find((a) => !a.startsWith('--')) ?? 'launch-day-revenue-engine'
const maxFlag = args.find((a) => a.startsWith('--max='))
const maxEvents = maxFlag ? parseInt(maxFlag.split('=')[1], 10) : Infinity

const adapters: Record<string, ChannelAdapter> = {
  web: webAdapter,
  whatsapp: whatsappAdapter,
  instagram: instagramAdapter,
  telegram: telegramAdapter,
}

const MCP_CONFIG = resolve('.mcp.json')
if (!existsSync(MCP_CONFIG)) {
  console.error('Missing .mcp.json — run `bun run setup:mcp` first.')
  process.exit(1)
}

console.log(`[world] starting scenario "${scenarioId}"...`)
const start = await callSandboxTool<{ status: string; run: { scenarioId: string } }>('world_start_scenario', {
  scenarioId,
})
console.log(`[world] ${start.status} — ${start.run.scenarioId}`)

let processed = 0
let agentCalls = 0
let totalCost = 0

while (processed < maxEvents) {
  const next = (await callSandboxTool<NextEventResponse>('world_next_event', {})) as NextEventResponse
  if (next.status !== 'delivered' || !next.event) {
    console.log(`\n[world] no more events (status=${next.status})`)
    break
  }
  const evt = next.event
  console.log(`\n[evt ${processed + 1}] minute=${evt.minute} ${evt.channel}/${evt.type} priority=${evt.priority}`)
  console.log(`         payload: ${JSON.stringify(evt.payload).slice(0, 200)}`)

  if (evt.channel === 'whatsapp' && evt.type === 'inbound_message') {
    const p = evt.payload as { from: string; message: string; intent?: string }
    const msg: IncomingMessage = {
      channel: 'whatsapp',
      threadId: p.from,
      senderId: p.from,
      text: p.message,
      timestamp: new Date(evt.deliveredAt).getTime(),
      raw: evt,
    }
    const role = pickRole(msg)
    const run = await invokeAgent({ role, msg, mcpConfigPath: MCP_CONFIG })
    recordRun(msg.threadId, run)
    agentCalls++
    totalCost += run.cost_usd ?? 0
    if (run.reply && adapters[msg.channel]) {
      await adapters[msg.channel].send(msg.threadId, run.reply)
    }
    console.log(`         → ${role}: ${run.reply.slice(0, 100)}${run.reply.length > 100 ? '...' : ''}`)
    console.log(`         tools=${run.tool_calls.length} dur=${run.duration_ms}ms cost=$${run.cost_usd ?? '?'}`)
  } else if (evt.channel === 'instagram' && (evt.type === 'inbound_dm' || evt.type === 'inbound_message')) {
    const p = evt.payload as { threadId?: string; from?: string; message: string }
    const tid = p.threadId ?? p.from ?? `ig_unknown_${evt.id}`
    const msg: IncomingMessage = {
      channel: 'instagram',
      threadId: tid,
      senderId: tid,
      text: p.message,
      timestamp: new Date(evt.deliveredAt).getTime(),
      raw: evt,
    }
    const role = pickRole(msg)
    const run = await invokeAgent({ role, msg, mcpConfigPath: MCP_CONFIG })
    recordRun(msg.threadId, run)
    agentCalls++
    totalCost += run.cost_usd ?? 0
    if (run.reply && adapters[msg.channel]) {
      await adapters[msg.channel].send(msg.threadId, run.reply)
    }
    console.log(`         → ${role}: ${run.reply.slice(0, 100)}${run.reply.length > 100 ? '...' : ''}`)
    console.log(`         tools=${run.tool_calls.length} dur=${run.duration_ms}ms cost=$${run.cost_usd ?? '?'}`)
  } else if (evt.channel === 'google_business' && evt.type === 'review') {
    const p = evt.payload as { reviewId: string; rating: number; content: string }
    console.log(`         GBP review (${p.rating}★): "${p.content.slice(0, 100)}"`)
    // Owner agent drafts a reply; sandbox records via gb_simulate_reply.
    const reply = `Thank you for the feedback. We'll do better next time — and please reach out via WhatsApp if you'd like to talk it through.`
    await tryCallSandboxTool('gb_simulate_reply', { reviewId: p.reviewId, reply })
    console.log(`         → gb_simulate_reply queued`)
  } else if (evt.channel === 'kitchen' && evt.type === 'ticket_ready') {
    const p = evt.payload as { ticketId: string; orderId?: string }
    console.log(`         kitchen marked ticket ${p.ticketId} ready (TODO: notify customer in PR #8)`)
  } else {
    console.log(`         (no handler for ${evt.channel}/${evt.type} yet)`)
  }

  processed++
}

console.log(`\n═══════════ scenario summary ═══════════`)
const summary = await callSandboxTool('world_get_scenario_summary', {})
console.log(JSON.stringify(summary, null, 2))
console.log(`\nProcessed: ${processed} events · ${agentCalls} agent calls · $${totalCost.toFixed(2)} total`)
