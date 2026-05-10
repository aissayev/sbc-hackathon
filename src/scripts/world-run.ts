// World scenario consumer.
// Starts (or resumes) a sandbox scenario and pumps every event through the
// shared dispatcher (`world-dispatch.ts`), which routes by (channel, type) and
// fires either an agent turn or a deterministic tool chain so every event
// hits at least one MCP call (audit trail evidence).
//
// Usage:
//   bun run world:run                              # default scenario
//   bun run world:run weekend-capacity-crunch      # specific scenario
//   bun run world:run --max=5                      # cap event count
//
// See docs/04-test/WORLD-SCENARIOS.md for the full taxonomy + handler map.

import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { callSandboxTool } from '../lib/sandbox-mcp.ts'
import { dispatchWorldEvent, type WorldEvent } from './world-dispatch.ts'

interface NextEventResponse {
  status: 'delivered' | 'idle' | 'finished' | 'complete'
  event?: WorldEvent
  run?: { scenarioId?: string; name?: string }
}

const args = process.argv.slice(2)
const scenarioId = args.find((a) => !a.startsWith('--')) ?? 'launch-day-revenue-engine'
const maxFlag = args.find((a) => a.startsWith('--max='))
const maxEvents = maxFlag ? parseInt(maxFlag.split('=')[1], 10) : Infinity

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
const handled = new Map<string, number>()
const unhandled: string[] = []

while (processed < maxEvents) {
  const next = (await callSandboxTool<NextEventResponse>('world_next_event', {})) as NextEventResponse
  if (next.status !== 'delivered' || !next.event) {
    console.log(`\n[world] no more events (status=${next.status})`)
    break
  }
  const evt = next.event
  console.log(`\n[evt ${processed + 1}] minute=${evt.minute} ${evt.channel}/${evt.type} priority=${evt.priority}`)
  console.log(`         payload: ${JSON.stringify(evt.payload).slice(0, 200)}`)

  const key = `${evt.channel}/${evt.type}`
  handled.set(key, (handled.get(key) ?? 0) + 1)

  const result = await dispatchWorldEvent(evt, MCP_CONFIG)
  agentCalls += result.agentCalls
  totalCost += result.costUsd

  if (!result.handled) {
    unhandled.push(key)
    console.log(`         (no handler for ${key} — falls through)`)
  } else if (result.reply) {
    console.log(`         → reply: ${result.reply.slice(0, 100)}${result.reply.length > 100 ? '...' : ''}`)
    console.log(`         tools=${result.toolCount} cost=$${result.costUsd}`)
  } else {
    console.log(`         → deterministic handler ran (no agent turn)`)
  }

  processed++
}

console.log(`\n═══════════ scenario summary ═══════════`)
const summary = await callSandboxTool('world_get_scenario_summary', {})
console.log(JSON.stringify(summary, null, 2))
console.log(`\nProcessed: ${processed} events · ${agentCalls} agent calls · $${totalCost.toFixed(2)} total`)
console.log(`\nHandled by type:`)
for (const [k, v] of [...handled.entries()].sort()) {
  console.log(`  ${k.padEnd(40)} × ${v}`)
}
if (unhandled.length > 0) {
  console.log(`\nUnhandled types (add to world-dispatch.ts):`)
  for (const k of [...new Set(unhandled)]) console.log(`  - ${k}`)
}
