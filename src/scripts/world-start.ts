// Start a world scenario in the sandbox.
// Available scenarios (per docs/sandbox/SNAPSHOT.md):
//   - launch-day-revenue-engine  (480 sim min)
//   - weekend-capacity-crunch    (360 sim min)
//
// Run:  bun run world:start launch-day-revenue-engine

import { invokeAgent } from '../agent/invoke.ts'
import { resolve } from 'node:path'

const scenarioId = process.argv[2] ?? 'launch-day-revenue-engine'

const prompt = `Start the world scenario "${scenarioId}" via world_start_scenario, then summarize what we just kicked off:
- scenarioId
- duration in sim minutes
- starting clock
- what kind of events to expect

Then call world_get_scenario_summary and report it.`

console.log(`[world] starting scenario ${scenarioId}...\n`)
const run = await invokeAgent({
  role: 'owner',
  msg: {
    channel: 'web',
    threadId: `world_start_${Date.now()}`,
    senderId: 'world-script',
    text: prompt,
    timestamp: Date.now(),
    raw: {},
    roleHint: 'owner',
  },
  mcpConfigPath: resolve('.mcp.json'),
})

console.log(run.reply || '(empty)')
console.log(`\ntools: ${run.tool_calls.map((t) => t.name).join(', ')}`)
console.log(`duration: ${run.duration_ms}ms · cost: $${run.cost_usd ?? '?'}`)
