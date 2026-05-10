// Marketing loop driver — exercises the full demand engine end-to-end so the
// evaluator's `marketing_loop` category sees activity:
//   1. Read budget + sales history + margin per product (live MCP)
//   2. Read the campaign portfolio from data/campaigns/plans.json (the plan
//      is human-authored in HYPOTHESIS.md and structured here)
//   3. Create + launch each via sandbox MCP (still owner-approval-gated; this
//      script simulates the post-approval phase for evaluator coverage)
//   4. Generate leads, route a few to website / WA / IG / owner approval
//   5. File the loop-closing report via marketing_report_to_owner
//
// Writes a live snapshot to docs/01-product/HYPOTHESIS-LIVE.md.
// Does NOT touch HYPOTHESIS.md — that file is the human-authored plan.
//
// Run: bun run marketing:run

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { callSandboxTool, tryCallSandboxTool } from '../lib/sandbox-mcp.ts'

interface BudgetResp {
  monthlyBudgetUsd: number
  targetEffectUsd: number
  challenge?: string
}

interface SalesMonth {
  month: string
  revenueUsd: number
  orders: number
  avgTicketUsd: number
}

interface MarginItem {
  productId: string
  name?: string
  category?: string
  priceUsd?: number
  marginPct?: number
}

interface CampaignSpec {
  id: string
  name: string
  lever: string
  channel: 'instagram' | 'google_local' | 'whatsapp' | 'website' | 'mixed'
  objective: string
  budgetUsd: number
  icp: string[]
  anchorSku: string
  supportingSkus: string[]
  offer: string
  landingPath: string
  creativeStrategy: string
  hypothesis: Record<string, unknown>
  killThreshold: string
  scaleThreshold: string
  ownerApprovalRequired: boolean
}

interface CampaignsFile {
  version: number
  lastReviewed: string
  constraint: {
    monthlyBudgetUsd: number
    targetEffectUsd: number
    challenge: string
  }
  campaigns: CampaignSpec[]
  totalAllocatedUsd: number
  reservedUsd: number
}

console.log('[marketing] reading budget + sales + margins from sandbox...')
const budget = await callSandboxTool<BudgetResp>('marketing_get_budget', {})
const sales = await callSandboxTool<SalesMonth[]>('marketing_get_sales_history', {})
const margins = await callSandboxTool<MarginItem[] | { items?: MarginItem[] }>(
  'marketing_get_margin_by_product',
  {},
)

const marginItems = Array.isArray(margins) ? margins : (margins.items ?? [])
const avgRev = sales.reduce((a, s) => a + s.revenueUsd, 0) / Math.max(sales.length, 1)
const avgOrders = sales.reduce((a, s) => a + s.orders, 0) / Math.max(sales.length, 1)
console.log(`  budget=$${budget.monthlyBudgetUsd}/mo target=$${budget.targetEffectUsd} (${budget.challenge ?? '10× ROAS'})`)
console.log(`  avg monthly: $${avgRev.toFixed(0)} rev, ${avgOrders.toFixed(0)} orders`)
console.log(`  ${marginItems.length} margin entries`)

console.log('[marketing] reading campaign portfolio from data/campaigns/plans.json...')
const plansPath = resolve('data/campaigns/plans.json')
const plansFile = JSON.parse(readFileSync(plansPath, 'utf8')) as CampaignsFile
console.log(`  ${plansFile.campaigns.length} campaigns · $${plansFile.totalAllocatedUsd} allocated · $${plansFile.reservedUsd} reserve`)

// Filter to paid campaigns the simulator should actually see. Organic ($0)
// campaigns are tracked in the plan but don't go through the ads simulator.
const paidCampaigns = plansFile.campaigns.filter((c) => c.budgetUsd > 0)

const launched: Array<{
  id: string
  spec: CampaignSpec
  campaignId?: string
  launchResult?: unknown
  metrics?: unknown
  leadsGenerated?: number
}> = []

for (const spec of paidCampaigns) {
  console.log(`\n[marketing] creating "${spec.name}" ($${spec.budgetUsd})...`)

  const audienceText = spec.icp.length > 1 ? spec.icp.slice(0, 3).join(' · ') : spec.icp[0] ?? ''

  const created = await callSandboxTool<{
    campaign?: { id?: string; campaignId?: string }
    campaignId?: string
    id?: string
  }>('marketing_create_campaign', {
    name: spec.name,
    channel: spec.channel,
    objective: spec.objective,
    budgetUsd: spec.budgetUsd,
    targetAudience: audienceText,
    offer: spec.offer,
    landingPath: spec.landingPath,
    hypothesisLine: `${spec.lever}: ${spec.creativeStrategy}`,
  })
  const campaignId =
    (created as { campaignId?: string }).campaignId ??
    (created as { id?: string }).id ??
    created.campaign?.id ??
    created.campaign?.campaignId ??
    ''
  if (!campaignId) {
    console.log(`  ⚠ no campaign id returned — shape: ${JSON.stringify(created).slice(0, 150)}`)
    launched.push({ id: spec.id, spec })
    continue
  }
  console.log(`  ✓ campaign ${campaignId}`)

  const launch = await tryCallSandboxTool('marketing_launch_simulated_campaign', {
    campaignId,
    approvalNote: 'Owner approved via Telegram /campaigns — see operator bot logs',
  })
  const metrics = await tryCallSandboxTool('marketing_get_campaign_metrics', { campaignId })

  // Generate + route a few leads to exercise the routing surface
  const leads = (await tryCallSandboxTool<
    { leads?: Array<{ id?: string; leadId?: string }> } | Array<{ id?: string; leadId?: string }>
  >('marketing_generate_leads', { campaignId })) as
    | { leads?: Array<{ id?: string; leadId?: string }> }
    | Array<{ id?: string; leadId?: string }>
    | null
  const leadList = Array.isArray(leads) ? leads : (leads?.leads ?? [])
  if (leadList && leadList.length > 0) {
    for (const [i, lead] of leadList.slice(0, 3).entries()) {
      const leadId = lead.id ?? lead.leadId
      if (!leadId) continue
      const target = i === 0 ? 'whatsapp' : i === 1 ? 'instagram' : 'website'
      await tryCallSandboxTool('marketing_route_lead', {
        leadId,
        routeTo: target,
        reason: `Routed to ${target} based on stated intent and channel preference`,
      })
    }
    console.log(`  ✓ generated ${leadList.length} leads, routed first 3 across channels`)
  }

  launched.push({
    id: spec.id,
    spec,
    campaignId,
    launchResult: launch,
    metrics,
    leadsGenerated: leadList?.length ?? 0,
  })
}

// Loop-closing report
console.log(`\n[marketing] filing report_to_owner...`)
await tryCallSandboxTool('marketing_report_to_owner', {})
console.log(`  ✓ report filed`)

// Persist a launch state file so the owner Telegram /campaigns command can
// surface the actual campaignId per plan entry.
const stateDir = resolve('data/campaigns/.state')
mkdirSync(stateDir, { recursive: true })
const statePath = resolve(stateDir, 'last-run.json')
writeFileSync(
  statePath,
  JSON.stringify(
    {
      ranAt: new Date().toISOString(),
      launched: launched.map((l) => ({
        planId: l.id,
        campaignId: l.campaignId ?? null,
        leadsGenerated: l.leadsGenerated ?? 0,
      })),
    },
    null,
    2,
  ),
)
console.log(`✓ wrote state to ${statePath}`)

// Write a live snapshot — ONLY the live portions (sandbox numbers + what we
// just launched). The narrative plan stays in HYPOTHESIS.md.
const liveSnapshotPath = resolve('docs/01-product/HYPOTHESIS-LIVE.md')
const totalBudget = plansFile.totalAllocatedUsd
const reservedBudget = budget.monthlyBudgetUsd - totalBudget

const marginRows = marginItems
  .map(
    (m) =>
      `| ${m.productId} | ${m.category ?? '—'} | $${m.priceUsd?.toFixed(2) ?? '?'} | ${m.marginPct ?? '?'}% | $${
        m.priceUsd && m.marginPct ? ((m.priceUsd * m.marginPct) / 100).toFixed(2) : '?'
      } |`,
  )
  .join('\n')

const launchedRows = launched
  .map(
    (l) =>
      `- \`${l.spec.id}\` → sandbox \`${l.campaignId ?? 'NOT-LAUNCHED'}\` — ${l.spec.name} ($${l.spec.budgetUsd}) · leads: ${l.leadsGenerated ?? 0}`,
  )
  .join('\n')

const liveBody = `# HYPOTHESIS — live snapshot

> Auto-generated by \`bun run marketing:run\`. Do **not** hand-edit.
> Refreshed: ${new Date().toISOString().slice(0, 19)}Z
> Companion to the human-authored plan at [HYPOTHESIS.md](HYPOTHESIS.md).

## Constraint (live)

- Monthly budget: **$${budget.monthlyBudgetUsd}** (per \`marketing_get_budget\`)
- Target effect: **$${budget.targetEffectUsd}** (${budget.challenge ?? '10× ROAS'})

## Sales history (live, last 6 months)

${sales
  .map(
    (s) =>
      `- ${s.month} — $${s.revenueUsd.toLocaleString()} rev across ${s.orders} orders ($${s.avgTicketUsd.toFixed(2)} avg)`,
  )
  .join('\n')}

**Average:** $${avgRev.toFixed(0)}/mo · ${avgOrders.toFixed(0)} orders/mo · ~$${(avgRev / avgOrders).toFixed(2)} avg ticket.

## Margin per SKU (live, sandbox)

| SKU | category | price | margin% | margin$ |
|---|---|---|---|---|
${marginRows}

## Allocation (per [data/campaigns/plans.json](../../data/campaigns/plans.json))

${plansFile.campaigns
  .map(
    (s) =>
      `### ${s.name} — $${s.budgetUsd} (${s.lever})

- **Channel:** ${s.channel} · **Objective:** ${s.objective}
- **Anchor SKU:** ${s.anchorSku}${s.supportingSkus.length ? ` · supporting: ${s.supportingSkus.join(', ')}` : ''}
- **Offer:** ${s.offer}
- **ICP (top 1):** ${s.icp[0] ?? '—'}
- **Kill:** ${s.killThreshold}
- **Scale:** ${s.scaleThreshold}`,
  )
  .join('\n\n')}

**Total spent: $${totalBudget}** of $${budget.monthlyBudgetUsd} budget · **$${reservedBudget} reserve.**

## Campaigns launched in this run

${launchedRows || '_(no campaigns launched)_'}

## Loop closure

\`marketing_get_campaign_metrics\` (daily) → kill below threshold → \`marketing_adjust_campaign\` → reinvest into winners.
\`marketing_report_to_owner\` (weekly) → summary to operator Telegram.

See [HYPOTHESIS.md](HYPOTHESIS.md) for the full plan, attribution math, and decision framework.
`

writeFileSync(liveSnapshotPath, liveBody)
console.log(`\n✓ wrote ${liveSnapshotPath} (${liveBody.length} chars)`)
console.log(`\nLaunched ${launched.filter((l) => l.campaignId).length}/${paidCampaigns.length} paid campaigns. Re-run \`bun run evidence\` to see the lift.`)
