// Daily self-evaluation cron — runs the sandbox evaluator and posts
// score deltas to the owner's Telegram chat.
//
// Designed for Innovation rubric line: "the system grades itself."
//
// Run: bun src/scripts/self-eval.ts
// State: .data/self-eval-history.json (last N scores for delta computation)

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { tryCallSandboxTool } from '../lib/sandbox-mcp.ts'
import { logSystem } from '../bots/owner/index.ts'

interface ScoreShape {
  channel_response?: number
  marketing_loop?: number
  pos_kitchen_flow?: number
  world_scenario?: number
  total?: number
}

interface HistoryEntry {
  ts: number
  scores: ScoreShape
}

const HISTORY_PATH = resolve('.data/self-eval-history.json')
const MAX_HISTORY = 30

function loadHistory(): HistoryEntry[] {
  if (!existsSync(HISTORY_PATH)) return []
  try {
    return JSON.parse(readFileSync(HISTORY_PATH, 'utf8')) as HistoryEntry[]
  } catch {
    return []
  }
}

function saveHistory(entries: HistoryEntry[]): void {
  mkdirSync(resolve('.data'), { recursive: true })
  writeFileSync(HISTORY_PATH, JSON.stringify(entries.slice(-MAX_HISTORY), null, 2))
}

function delta(curr: number | undefined, prev: number | undefined): string {
  if (curr === undefined) return '?'
  if (prev === undefined) return `${curr}`
  const d = curr - prev
  if (d === 0) return `${curr} (=)`
  return `${curr} (${d > 0 ? '+' : ''}${d})`
}

async function main(): Promise<void> {
  // Pull all four scores in parallel.
  const [chRaw, mkRaw, posRaw, worRaw] = await Promise.all([
    tryCallSandboxTool<{ score?: number }>('evaluator_score_channel_response', {}),
    tryCallSandboxTool<{ score?: number }>('evaluator_score_marketing_loop', {}),
    tryCallSandboxTool<{ score?: number }>('evaluator_score_pos_kitchen_flow', {}),
    tryCallSandboxTool<{ score?: number }>('evaluator_score_world_scenario', {}),
  ])

  const scores: ScoreShape = {
    channel_response: chRaw?.score,
    marketing_loop: mkRaw?.score,
    pos_kitchen_flow: posRaw?.score,
    world_scenario: worRaw?.score,
  }
  const total =
    (scores.channel_response ?? 0) +
    (scores.marketing_loop ?? 0) +
    (scores.pos_kitchen_flow ?? 0) +
    (scores.world_scenario ?? 0)
  scores.total = total

  const history = loadHistory()
  const prev = history[history.length - 1]?.scores ?? {}

  const summary = [
    `\ud83d\udcca Daily evaluator score: ${delta(total, prev.total)}/400`,
    `   channel_response: ${delta(scores.channel_response, prev.channel_response)}`,
    `   marketing_loop:   ${delta(scores.marketing_loop, prev.marketing_loop)}`,
    `   pos_kitchen_flow: ${delta(scores.pos_kitchen_flow, prev.pos_kitchen_flow)}`,
    `   world_scenario:   ${delta(scores.world_scenario, prev.world_scenario)}`,
  ].join('\n')

  console.log(summary)
  // Log to TG owner (verbose level — these are system events)
  logSystem(summary, 'always')

  saveHistory([...history, { ts: Date.now(), scores }])
}

main().catch((err) => {
  console.error('[self-eval] fatal:', err)
  process.exit(1)
})
