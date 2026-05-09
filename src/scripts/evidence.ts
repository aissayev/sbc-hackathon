// Pre-submit evidence preview. Spawns claude -p in "owner" role and asks it to
// call the sandbox evaluator tools, returning what the judges will see.
//
// Run:  bun run evidence
//
// Note: returns empty for fresh teams. Generate activity first via:
//   bun run world:start
//   then process inbound events through the agent
//   then re-run this script.

import { invokeAgent } from '../agent/invoke.ts'
import { resolve } from 'node:path'

const prompt = `Pull the current evaluator evidence for our team and summarize.

Steps:
1. Call evaluator_get_evidence_summary to get the baseline.
2. Call evaluator_score_channel_response, evaluator_score_marketing_loop, evaluator_score_pos_kitchen_flow, evaluator_score_world_scenario to see per-rubric scores.
3. Return a markdown summary with each rubric line, our current score, and the top 1-2 things that would lift each score.

Be terse. The audience is the team lead (Adilet) reading this on his phone.`

console.log('[evidence] requesting baseline from sandbox evaluator...\n')

const run = await invokeAgent({
  role: 'owner',
  msg: {
    channel: 'web',
    threadId: `evidence_${Date.now()}`,
    senderId: 'evidence-script',
    senderName: 'Evidence Script',
    text: prompt,
    timestamp: Date.now(),
    raw: {},
    roleHint: 'owner',
  },
  mcpConfigPath: resolve('.mcp.json'),
  timeoutMs: 180_000,
})

console.log('═════════ EVIDENCE BASELINE ═════════\n')
console.log(run.reply || '(empty)')
console.log('\n═════════ TOOL CALLS ═════════')
for (const t of run.tool_calls) console.log(`  • ${t.name}`)
console.log(`\nduration: ${run.duration_ms}ms · cost: $${run.cost_usd ?? '?'}`)

process.exit(run.exit_code === 0 && run.reply ? 0 : 1)
