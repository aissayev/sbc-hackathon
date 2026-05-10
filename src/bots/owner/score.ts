// /score — pull the rubric scores from the sandbox evaluator and render them
// as a TG-friendly box. Same cost profile as the /campaigns / /spend / /gb
// commands: HTTP to the sandbox MCP using the team token, no claude -p spend.
//
// The evaluator scores four dimensions out of 400 total:
//   - channel response       (WA / IG / GBP outbound)
//   - marketing loop         (campaigns + leads + reports)
//   - POS + kitchen handoff  (orders + ticket variance)
//   - world scenario         (events processed)
//
// Each call returns { dimension, score, maxScore, evidence[], gaps[] }.

import { tryCallSandboxTool } from '../../lib/sandbox-mcp.ts'
import type { BotReply } from './commands.ts'

interface DimensionScore {
  dimension: string
  score: number
  maxScore: number
  evidence?: string[]
  gaps?: string[]
}

const SCORE_TOOLS: Array<{ tool: string; label: string }> = [
  { tool: 'evaluator_score_channel_response', label: 'Channel response' },
  { tool: 'evaluator_score_marketing_loop', label: 'Marketing loop' },
  { tool: 'evaluator_score_pos_kitchen_flow', label: 'POS + kitchen' },
  { tool: 'evaluator_score_world_scenario', label: 'World scenario' },
]

export async function scoreReply(): Promise<BotReply> {
  const results = await Promise.all(
    SCORE_TOOLS.map(async ({ tool, label }) => {
      const r = (await tryCallSandboxTool<DimensionScore>(tool, {})) ?? null
      return { label, data: r }
    }),
  )

  let total = 0
  let max = 0
  const lines: string[] = ['Rubric scores (sandbox evaluator)', '']

  for (const { label, data } of results) {
    if (!data) {
      lines.push(`${label.padEnd(18)} —`)
      continue
    }
    total += data.score ?? 0
    max += data.maxScore ?? 0
    const pct = data.maxScore ? Math.round((data.score / data.maxScore) * 100) : 0
    const flag = pct === 100 ? '✅' : pct >= 80 ? '⚠️' : '❌'
    lines.push(`${flag} ${label.padEnd(16)} ${data.score}/${data.maxScore}  (${pct}%)`)
    const topGap = data.gaps?.[0]
    if (topGap && pct < 100) {
      lines.push(`     gap: ${topGap}`)
    }
  }

  if (max === 0) {
    return {
      text: 'Could not reach the evaluator. Check SBC_TEAM_TOKEN and try again.',
    }
  }

  const totalPct = Math.round((total / max) * 100)
  lines.push('')
  lines.push(`Total: ${total}/${max}  (${totalPct}%)`)
  lines.push('')
  lines.push('Run `bun run evidence` for the full per-tool trace + cost.')

  return { text: lines.join('\n') }
}
