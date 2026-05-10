// World scenario single-tick driver. Pulls the *next* event from the sandbox
// world and drives it through the shared dispatcher (`world-dispatch.ts`),
// then exits. Designed to be run from a cron / scheduled task without
// spinning up the long-poller daemon. The build plan calls for a 10s tick:
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
// Exits 0 when an event was delivered + handled, 0 when idle/finished,
// non-zero on infrastructure errors so the cron caller can surface failures.

import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { callSandboxTool, SandboxMcpError } from '../lib/sandbox-mcp.ts'
import { dispatchWorldEvent, type WorldEvent } from './world-dispatch.ts'

interface NextEventResponse {
  status: 'delivered' | 'idle' | 'finished' | 'complete'
  event?: WorldEvent
  run?: { scenarioId?: string; name?: string }
}

const args = process.argv.slice(2)
const scenarioFlag = args.find((a) => a.startsWith('--scenario='))
const scenarioId = scenarioFlag ? scenarioFlag.split('=')[1] : 'launch-day-revenue-engine'
const shouldStart = args.includes('--start')

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

const result = await dispatchWorldEvent(evt, MCP_CONFIG)
if (!result.handled) {
  console.log(`             (no handler for ${evt.channel}/${evt.type})`)
} else if (result.reply) {
  console.log(`             → tools=${result.toolCount} cost=$${result.costUsd}`)
  console.log(`             reply: ${result.reply.slice(0, 120)}${result.reply.length > 120 ? '…' : ''}`)
} else {
  console.log(`             → deterministic handler ran`)
}

process.exit(0)
