// Per-role agent CLI. Invoke any agent like a customer message lands at the gate,
// without going through a real channel. Useful for manual testing, demo recording,
// and running scenarios from the shell.
//
// Usage:
//   bun run agent:concierge "do you have honey cake?"
//   bun run agent:owner "/today"
//   bun run agent:kitchen "what's our load saturday?"
//   bun run agent:marketing "draft a campaign for whole honey cake, $80 budget"
//
// Behavior:
//   - Picks the role from argv[2] (concierge | kitchen | marketing | owner).
//   - Prompt is the rest of argv joined.
//   - Spawns claude -p with the role's system prompt + tool allowlist.
//   - Prints reply, tool trace, cost.
//   - Persists thread history same as a real channel — set --thread <id> to continue.

import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { invokeAgent } from '../agent/invoke.ts'
import type { AgentRole } from '../channels/types.ts'

const VALID_ROLES = new Set<AgentRole>(['concierge', 'kitchen', 'marketing', 'owner'])

function parseArgs(argv: string[]): { role: AgentRole; threadId: string; text: string } {
  const role = argv[2] as AgentRole
  if (!VALID_ROLES.has(role)) {
    console.error(`Usage: bun run agent:<role> "<message>"`)
    console.error(`  role ∈ {concierge, kitchen, marketing, owner}`)
    console.error(`  got: ${role}`)
    process.exit(2)
  }
  const rest = argv.slice(3)
  let threadId = `cli_${role}_${Date.now()}`
  const tIdx = rest.indexOf('--thread')
  if (tIdx >= 0 && rest[tIdx + 1]) {
    threadId = rest[tIdx + 1]
    rest.splice(tIdx, 2)
  }
  const text = rest.join(' ')
  if (!text) {
    console.error('Usage: bun run agent:<role> "<message>"')
    process.exit(2)
  }
  return { role, threadId, text }
}

const { role, threadId, text } = parseArgs(process.argv)

if (!existsSync('.mcp.json')) {
  console.error('Missing .mcp.json — run `bun run setup:mcp` first.')
  process.exit(1)
}

console.log(`[cli] role=${role} thread=${threadId}`)
console.log(`[cli] message: ${text}`)
console.log(`[cli] invoking claude -p (10–60s)...\n`)

const run = await invokeAgent({
  role,
  msg: {
    channel: 'web',
    threadId,
    senderId: `cli-${process.env.USER ?? 'dev'}`,
    senderName: 'CLI',
    text,
    timestamp: Date.now(),
    raw: {},
    roleHint: role,
  },
  mcpConfigPath: resolve('.mcp.json'),
  timeoutMs: 180_000,
})

console.log('───────── reply ─────────')
console.log(run.reply || '(empty)')
console.log('───────── trace ─────────')
console.log(`tools called: ${run.tool_calls.length}`)
for (const t of run.tool_calls) console.log(`  • ${t.name}`)
console.log(`duration: ${run.duration_ms}ms · cost: $${run.cost_usd ?? '?'} · exit ${run.exit_code}`)
if (run.error) console.log(`error: ${run.error}`)

process.exit(run.exit_code === 0 && run.reply ? 0 : 1)
