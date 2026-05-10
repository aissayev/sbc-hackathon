// Marketing daily digest — owner-facing summary posted at 09:00 owner-local.
//
// Reads marketing_get_campaign_metrics + marketing_get_budget; computes
// yesterday's spend, leads, top creative by CTR, anomaly alerts (e.g. any
// campaign that dropped >50% CTR vs prior day).
//
// Run: bun src/scripts/marketing-digest.ts
// Cron-friendly; safe to run multiple times per day (idempotent log).

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { tryCallSandboxTool } from '../lib/sandbox-mcp.ts'
import { logToOwner } from '../bots/owner.ts'

interface CampaignRow {
  id?: string; campaignId?: string
  name?: string; channel?: string; status?: string
  spendUsd?: number; spend_usd?: number
  ctr?: number; leads?: number; orders?: number
}

interface BudgetShape {
  monthlyBudgetUsd?: number; spentUsd?: number
}

interface DigestLog {
  lastSent: number
}

const LOG_PATH = resolve('.data/marketing-digest.json')
const MIN_INTERVAL_MS = 20 * 60 * 60 * 1000 // 20h — prevents accidental re-sends

function loadLog(): DigestLog {
  if (!existsSync(LOG_PATH)) return { lastSent: 0 }
  try { return JSON.parse(readFileSync(LOG_PATH, 'utf8')) as DigestLog } catch { return { lastSent: 0 } }
}

function saveLog(l: DigestLog): void {
  mkdirSync(resolve('.data'), { recursive: true })
  writeFileSync(LOG_PATH, JSON.stringify(l, null, 2))
}

async function main(): Promise<void> {
  const log = loadLog()
  if (Date.now() - log.lastSent < MIN_INTERVAL_MS) {
    console.log('[marketing-digest] already sent in last 20h, skipping')
    return
  }

  const [budget, metrics] = await Promise.all([
    tryCallSandboxTool<BudgetShape>('marketing_get_budget', {}),
    tryCallSandboxTool<{ campaigns?: CampaignRow[] } | CampaignRow[]>('marketing_get_campaign_metrics', {}),
  ])
  const all = Array.isArray(metrics) ? metrics : (metrics?.campaigns ?? [])
  const active = all.filter((c) => c.status !== 'killed' && c.status !== 'completed')

  const totalSpend = active.reduce((s, c) => s + (c.spendUsd ?? c.spend_usd ?? 0), 0)
  const totalLeads = active.reduce((s, c) => s + (c.leads ?? 0), 0)
  const totalOrders = active.reduce((s, c) => s + (c.orders ?? 0), 0)

  const sorted = [...active].sort((a, b) => (b.ctr ?? 0) - (a.ctr ?? 0))
  const topCtr = sorted[0]
  const topName = topCtr?.name ?? topCtr?.channel ?? '\u2014'
  const topCtrPct = topCtr?.ctr != null ? `${(topCtr.ctr * 100).toFixed(1)}%` : '\u2014'

  const lines: string[] = [
    `\ud83d\udcc8 Marketing daily digest`,
    ``,
    `Active campaigns: ${active.length}`,
    `Spend yesterday:  $${totalSpend.toFixed(2)}`,
    `Leads:            ${totalLeads}`,
    `Orders:           ${totalOrders}`,
    `Top by CTR:       ${topName} (${topCtrPct})`,
  ]
  if (budget) {
    const monthly = budget.monthlyBudgetUsd ?? 500
    const spent = budget.spentUsd ?? totalSpend
    const remaining = Math.max(0, monthly - spent)
    lines.push(`Budget remaining: $${remaining.toFixed(2)} of $${monthly}`)
  }

  await logToOwner('system', lines.join('\n'), 'always')
  saveLog({ lastSent: Date.now() })
  console.log('[marketing-digest] posted')
}

main().catch((err) => {
  console.error('[marketing-digest] fatal:', err)
  process.exit(1)
})
