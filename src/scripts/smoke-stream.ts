// Smoke-test the streaming path. Spawns claude -p with our exact flags and
// counts how many `text` events fire and what their cumulative length is.
// A healthy run shows MANY text events with monotonically growing
// running-text — that's per-token streaming working.
//
// Usage:  bun src/scripts/smoke-stream.ts ["custom prompt"]

import { invokeAgent } from '../agent/invoke.ts'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'

const text =
  process.argv.slice(2).join(' ') ||
  'In 4 sentences, what makes a great honey cake? No tools, just answer.'
const threadId = `smoke_stream_${Date.now()}`

// .mcp.json is optional for the streaming smoke — the test only needs claude -p
// to talk back. Without it, MCP tool calls won't work but text streaming still does.
const mcpConfigPath = existsSync('.mcp.json') ? resolve('.mcp.json') : undefined
if (!mcpConfigPath) {
  console.log('[stream-smoke] no .mcp.json — running without MCP (streaming-only test).')
}

let textEvents = 0
let toolStarts = 0
let lastRunningLen = 0
let firstTextAtMs = 0
const startedAt = Date.now()

console.log('[stream-smoke] invoking claude -p with --include-partial-messages')
console.log(`[stream-smoke] prompt: ${text}\n`)

const run = await invokeAgent({
  role: 'concierge',
  msg: {
    channel: 'web',
    threadId,
    senderId: threadId,
    senderName: 'Stream Smoke',
    text,
    timestamp: Date.now(),
    raw: {},
  },
  mcpConfigPath,
  onStream: (event) => {
    if (event.kind === 'text') {
      textEvents += 1
      if (firstTextAtMs === 0) firstTextAtMs = Date.now() - startedAt
      const grew = event.running.length - lastRunningLen
      lastRunningLen = event.running.length
      // Print every 5th to keep stdout readable
      if (textEvents % 5 === 0 || textEvents <= 3) {
        console.log(`  [text #${textEvents}] +${grew} chars → "${event.chunk.slice(0, 30)}…"`)
      }
    } else if (event.kind === 'tool_start') {
      toolStarts += 1
      console.log(`  [tool] ${event.name}`)
    } else if (event.kind === 'done') {
      console.log(`  [done] final length=${event.final.length}`)
    }
  },
})

console.log('\n───────── verdict ─────────')
console.log(`text events:        ${textEvents}`)
console.log(`tool starts:        ${toolStarts}`)
console.log(`first text at:      ${firstTextAtMs}ms`)
console.log(`final reply chars:  ${run.reply.length}`)
console.log(`duration:           ${run.duration_ms}ms`)
console.log(`cost:               $${run.cost_usd ?? '?'}`)

if (textEvents < 3) {
  console.log('\n⚠ FAIL: expected ≥3 text events for a 4-sentence reply.')
  console.log('   Either --include-partial-messages is not set or the')
  console.log('   stream_event handler isn\'t firing. Inspect src/agent/invoke.ts.')
  process.exit(1)
}
console.log('\n✓ PASS: per-token text streaming is live.')
process.exit(run.exit_code === 0 ? 0 : 1)
