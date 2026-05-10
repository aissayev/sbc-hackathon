// World scenario single-tick driver. Pulls the *next* event from the sandbox
// world and drives it through the same pipeline as `world:run`, then exits.
//
// Designed to be run from a system cron / scheduled task without spinning up
// the long-poller daemon. The build plan calls for a 10s tick:
//
//   * * * * *  bun run world:tick
//
// or, in-process:
//
//   setInterval(() => { Bun.spawnSync(['bun', 'run', 'world:tick']) }, 10_000)
//
// Usage:
//   bun run world:tick                  # advance one event (default scenario)
//   bun run world:tick --scenario=foo   # advance one event of a named scenario
//   bun run world:tick --start          # start scenario if not already started
//
// Exits 0 when an event was delivered + handled, 0 with code log when idle/finished,
// and non-zero on infrastructure errors (missing .mcp.json, MCP unreachable, etc.)
// so the cron caller can surface the failure.

import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { invokeAgent, recordRun } from '../agent/invoke.ts'
import { pickRole } from '../agent/router.ts'
import { whatsappAdapter } from '../channels/whatsapp.ts'
import { instagramAdapter } from '../channels/instagram/index.ts'
import { webAdapter } from '../channels/web.ts'
import { telegramAdapter } from '../channels/telegram.ts'
import { callSandboxTool, tryCallSandboxTool, SandboxMcpError } from '../lib/sandbox-mcp.ts'
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
const scenarioFlag = args.find((a) => a.startsWith('--scenario='))
const scenarioId = scenarioFlag ? scenarioFlag.split('=')[1] : 'launch-day-revenue-engine'
const shouldStart = args.includes('--start')

const adapters: Record<string, ChannelAdapter> = {
  web: webAdapter,
  whatsapp: whatsappAdapter,
  instagram: instagramAdapter,
  telegram: telegramAdapter,
}

const MCP_CONFIG = resolve('.mcp.json')
if (!existsSync(MCP_CONFIG)) {
  console.error('Missing .mcp.json — run `bun run setup:mcp` first.')
  process.exit(2)
}

if (shouldStart) {
  try {
    const start = await callSandboxTool<{ status: string; run: { scenarioId: string } }>('world_start_scenario', {
      scenarioId,
    })
    console.log(`[world:tick] start: ${start.status} — ${start.run.scenarioId}`)
  } catch (err) {
    if (err instanceof SandboxMcpError && /already/i.test(err.message)) {
      // Idempotent: scenario was already started by a previous tick. Fine.
      console.log(`[world:tick] scenario already running`)
    } else {
      console.error('[world:tick] start failed:', (err as Error).message)
      process.exit(3)
    }
  }
}

let next: NextEventResponse
try {
  next = await callSandboxTool<NextEventResponse>('world_next_event', {})
} catch (err) {
  console.error('[world:tick] world_next_event failed:', (err as Error).message)
  process.exit(3)
}

if (next.status !== 'delivered' || !next.event) {
  console.log(`[world:tick] no event (status=${next.status})`)
  process.exit(0)
}

const evt = next.event
console.log(`[world:tick] minute=${evt.minute} ${evt.channel}/${evt.type} priority=${evt.priority}`)

async function handleInbound(channel: 'whatsapp' | 'instagram', tid: string, text: string) {
  const msg: IncomingMessage = {
    channel,
    threadId: tid,
    senderId: tid,
    text,
    timestamp: new Date(evt.deliveredAt).getTime(),
    raw: evt,
  }
  const role = pickRole(msg)
  const run = await invokeAgent({ role, msg, mcpConfigPath: MCP_CONFIG })
  recordRun(msg.threadId, run)
  if (run.reply && adapters[channel]) {
    await adapters[channel].send(tid, run.reply)
  }
  console.log(`             → ${role}: tools=${run.tool_calls.length} dur=${run.duration_ms}ms cost=$${run.cost_usd ?? '?'}`)
  console.log(`             reply: ${run.reply.slice(0, 120)}${run.reply.length > 120 ? '…' : ''}`)
}

if (evt.channel === 'whatsapp' && evt.type === 'inbound_message') {
  const p = evt.payload as { from: string; message: string }
  await handleInbound('whatsapp', p.from, p.message)
} else if (evt.channel === 'instagram' && (evt.type === 'inbound_dm' || evt.type === 'inbound_message')) {
  const p = evt.payload as { threadId?: string; from?: string; message: string }
  await handleInbound('instagram', p.threadId ?? p.from ?? `ig_${evt.id}`, p.message)
} else if (evt.channel === 'google_business' && evt.type === 'review') {
  const p = evt.payload as { reviewId: string; rating: number; content: string }
  console.log(`             GBP review (${p.rating}★): ${p.content.slice(0, 100)}`)
  const reply = `Thank you for the feedback. We'll do better next time — please reach out via WhatsApp if you'd like to talk it through.`
  await tryCallSandboxTool('gb_simulate_reply', { reviewId: p.reviewId, reply })
} else if (evt.channel === 'kitchen' && evt.type === 'ticket_ready') {
  const p = evt.payload as { ticketId: string; orderId?: string }
  console.log(`             kitchen ticket ${p.ticketId} ready`)
} else {
  console.log(`             (no handler for ${evt.channel}/${evt.type})`)
}

process.exit(0)
