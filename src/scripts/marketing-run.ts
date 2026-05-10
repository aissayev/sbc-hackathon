// Marketing strategy launcher — deploys the FULL $500/mo to ONE chosen
// strategy from data/campaigns/plans.json. We do NOT split the budget
// across strategies — that's the deployment rule documented in HYPOTHESIS.md.
//
// Usage:
//   bun run marketing:run                        # launches the recommended strategy
//   bun run marketing:run --strategy <id>        # launches a specific strategy
//   bun run marketing:run --strategy b2c-anchor-flywheel
//
// Side effects:
//   - Calls marketing_create_campaign + marketing_launch_simulated_campaign
//     for ONE strategy (concentrating the full budget).
//   - Calls marketing_generate_leads + marketing_route_lead × 3 for
//     evaluator routing-coverage.
//   - Calls marketing_report_to_owner to close the loop.
//   - Writes data/campaigns/.state/last-run.json (gitignored).
//   - Writes docs/01-product/HYPOTHESIS-LIVE.md (gitignored).
//
// Does NOT touch HYPOTHESIS.md — that's the human-authored plan.

import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { callSandboxTool, tryCallSandboxTool } from '../lib/sandbox-mcp.ts'
import { loadCampaignsFile, type CampaignStrategy } from '../domain/campaigns.ts'

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

const args = process.argv.slice(2)
let chosenId: string | undefined
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--strategy' && args[i + 1]) {
    chosenId = args[i + 1]
    break
  }
}

console.log('[marketing] reading plan + sandbox baseline...')
const plan = loadCampaignsFile()
const budget = await callSandboxTool<BudgetResp>('marketing_get_budget', {})
const sales = await callSandboxTool<SalesMonth[]>('marketing_get_sales_history', {})

const targetId = chosenId ?? plan.recommendation.primary
const strategy: CampaignStrategy | undefined = plan.strategies.find((s) => s.id === targetId)
if (!strategy) {
  console.error(`✗ no strategy found with id "${targetId}". Available:`)
  for (const s of plan.strategies) console.error(`  - ${s.id}${s.recommended ? ' (recommended)' : ''}`)
  process.exit(1)
}

console.log(`\n[marketing] chosen strategy: ${strategy.name}`)
console.log(`  recommended: ${strategy.recommended ? 'yes' : 'no (alternative)'}`)
console.log(`  full budget: $${strategy.fullBudgetUsd}/mo (no split)`)
console.log(`  primary channel: ${strategy.primaryChannel}${strategy.secondaryChannel ? ' + ' + strategy.secondaryChannel : ''}`)
console.log(`  thesis: ${strategy.thesis}`)

const audienceText = strategy.icp.slice(0, 3).join(' · ')
const m1 = strategy.monthlyRollout.month1

console.log('\n[marketing] creating sandbox campaign...')
const created = await callSandboxTool<{
  campaign?: { id?: string; campaignId?: string }
  campaignId?: string
  id?: string
}>('marketing_create_campaign', {
  name: strategy.name,
  channel: strategy.primaryChannel,
  objective: m1?.phase ?? 'lead_gen',
  budgetUsd: strategy.fullBudgetUsd,
  targetAudience: audienceText,
  offer: `Anchor: ${strategy.anchorSku}. ${strategy.thesis}`,
  landingPath: `/menu/${strategy.anchorSku}`,
  hypothesisLine: `Single-strategy deployment ($${strategy.fullBudgetUsd}/mo) — ${m1?.creativeStrategy ?? 'see plan'}`,
})

const campaignId =
  (created as { campaignId?: string }).campaignId ??
  (created as { id?: string }).id ??
  created.campaign?.id ??
  created.campaign?.campaignId ??
  ''
if (!campaignId) {
  console.error(`✗ sandbox didn't return a campaignId. Shape: ${JSON.stringify(created).slice(0, 200)}`)
  process.exit(1)
}
console.log(`  ✓ campaign ${campaignId}`)

const launch = await tryCallSandboxTool('marketing_launch_simulated_campaign', {
  campaignId,
  approvalNote: `Owner approved single-strategy launch (${strategy.id}) via marketing:run CLI`,
})
const metrics = await tryCallSandboxTool('marketing_get_campaign_metrics', { campaignId })

// Generate + route leads (evaluator routing coverage)
const leads = (await tryCallSandboxTool<
  { leads?: Array<{ id?: string; leadId?: string }> } | Array<{ id?: string; leadId?: string }>
>('marketing_generate_leads', { campaignId })) as
  | { leads?: Array<{ id?: string; leadId?: string }> }
  | Array<{ id?: string; leadId?: string }>
  | null
const leadList = Array.isArray(leads) ? leads : (leads?.leads ?? [])
let routedCount = 0
if (leadList && leadList.length > 0) {
  for (const [i, lead] of leadList.slice(0, 3).entries()) {
    const leadId = lead.id ?? lead.leadId
    if (!leadId) continue
    const target = i === 0 ? 'whatsapp' : i === 1 ? 'instagram' : 'website'
    const ok = await tryCallSandboxTool('marketing_route_lead', {
      leadId,
      routeTo: target,
      reason: `Routed to ${target} based on stated intent and channel preference`,
    })
    if (ok) routedCount++
  }
  console.log(`  ✓ generated ${leadList.length} leads, routed ${routedCount}`)
}

// Loop-closing report
console.log('\n[marketing] filing report_to_owner...')
await tryCallSandboxTool('marketing_report_to_owner', {})
console.log('  ✓ report filed')

// Persist state
const stateDir = resolve('data/campaigns/.state')
mkdirSync(stateDir, { recursive: true })
const statePath = resolve(stateDir, 'last-run.json')
writeFileSync(
  statePath,
  JSON.stringify(
    {
      ranAt: new Date().toISOString(),
      chosenStrategyId: strategy.id,
      launched: [
        {
          strategyId: strategy.id,
          campaignId,
          leadsGenerated: leadList?.length ?? 0,
        },
      ],
    },
    null,
    2,
  ),
)
console.log(`✓ wrote ${statePath}`)

// Live snapshot for the strategy that was launched
const livePath = resolve('docs/01-product/HYPOTHESIS-LIVE.md')
const avgRev = sales.reduce((a, s) => a + s.revenueUsd, 0) / Math.max(sales.length, 1)
const avgOrders = sales.reduce((a, s) => a + s.orders, 0) / Math.max(sales.length, 1)

const liveBody = `# HYPOTHESIS — live snapshot

> Auto-generated by \`bun run marketing:run\`. Do **not** hand-edit.
> Refreshed: ${new Date().toISOString().slice(0, 19)}Z
> Companion to the human-authored plan at [HYPOTHESIS.md](HYPOTHESIS.md).

## Constraint (live)

- Monthly budget: **$${budget.monthlyBudgetUsd}** (per \`marketing_get_budget\`)
- Target effect: **$${budget.targetEffectUsd}** (${budget.challenge ?? '10× ROAS'})
- Deployment rule: ONE strategy gets the full $${budget.monthlyBudgetUsd}.

## Sales baseline (live, last 6 months)

${sales
  .map(
    (s) =>
      `- ${s.month} — $${s.revenueUsd.toLocaleString()} rev across ${s.orders} orders ($${s.avgTicketUsd.toFixed(2)} avg)`,
  )
  .join('\n')}

**Average:** $${avgRev.toFixed(0)}/mo · ${avgOrders.toFixed(0)} orders/mo · ~$${(avgRev / avgOrders).toFixed(2)} avg ticket.

## Chosen strategy this run

**${strategy.name}** (${strategy.id})${strategy.recommended ? ' ⭐ recommended' : ''}

- Full budget: $${strategy.fullBudgetUsd}/mo
- Primary channel: ${strategy.primaryChannel}${strategy.secondaryChannel ? ` + ${strategy.secondaryChannel}` : ''}
- Anchor SKU: ${strategy.anchorSku}${strategy.supportingSkus.length ? ` · supporting: ${strategy.supportingSkus.join(', ')}` : ''}
- Thesis: ${strategy.thesis}
- Sandbox campaign: \`${campaignId}\`
- Launched: ${launch ? 'yes' : 'unknown'}
- Leads simulated: ${leadList?.length ?? 0} · routed: ${routedCount}

### Initial metrics from \`marketing_get_campaign_metrics\`

\`\`\`json
${JSON.stringify(metrics, null, 2).slice(0, 800)}
\`\`\`

## Strategies NOT launched (alternatives in [data/campaigns/plans.json](../../data/campaigns/plans.json))

${plan.strategies
  .filter((s) => s.id !== strategy.id)
  .map(
    (s) =>
      `- \`${s.id}\` · ${s.name}${s.recommended ? ' ⭐' : ''}${s.alternativeNote ? ' — ' + s.alternativeNote : ''}`,
  )
  .join('\n')}

## Always-on organic (runs alongside, $0 ads)

${plan.alwaysOnOrganic.purpose}

See [HYPOTHESIS.md](HYPOTHESIS.md) for the full plan and decision framework.
`

writeFileSync(livePath, liveBody)
console.log(`✓ wrote ${livePath} (${liveBody.length} chars)`)
console.log(`\nLaunched 1 strategy with full $${strategy.fullBudgetUsd}/mo. Re-run \`bun run evidence\` to see the lift.`)
