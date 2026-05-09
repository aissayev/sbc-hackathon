// End-to-end smoke for the headless agent.
// Posts a synthetic web message into onMessage path and prints the reply.
//
// Usage:  bun src/scripts/smoke-agent.ts "I want a chocolate cake for tomorrow at 4pm"

import { invokeAgent } from '../agent/invoke.ts'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'

const text = process.argv.slice(2).join(' ') || 'I want a chocolate cake for tomorrow at 4pm pickup'
const threadId = `smoke_${Date.now()}`

if (!existsSync('.mcp.json')) {
  console.error('Missing .mcp.json — run `bun run setup:mcp` first.')
  process.exit(1)
}

console.log(`[smoke] role=concierge thread=${threadId}`)
console.log(`[smoke] message: ${text}`)
console.log(`[smoke] invoking claude -p (this may take 10-60s)...\n`)

const run = await invokeAgent({
  role: 'concierge',
  msg: {
    channel: 'web',
    threadId,
    senderId: threadId,
    senderName: 'Smoke Tester',
    text,
    timestamp: Date.now(),
    raw: {},
  },
  mcpConfigPath: resolve('.mcp.json'),
})

console.log('───────── reply ─────────')
console.log(run.reply || '(empty)')
console.log('───────── trace ─────────')
console.log(`tools called: ${run.tool_calls.length}`)
for (const t of run.tool_calls) {
  console.log(`  • ${t.name}`)
}
console.log(`duration: ${run.duration_ms}ms`)
console.log(`cost: $${run.cost_usd ?? '?'}`)
console.log(`exit: ${run.exit_code}`)
if (run.error) console.log(`error: ${run.error}`)

process.exit(run.exit_code === 0 && run.reply.length > 0 ? 0 : 1)
