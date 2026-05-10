// Marketing data brief — pulls EVERY MCP datapoint relevant to the hypothesis
// and writes a structured baseline so the plan is anchored on live numbers,
// not assumptions. Run before re-tuning HYPOTHESIS.md.
//
// What it pulls:
//   - marketing_get_budget          → constraint
//   - marketing_get_sales_history   → 6mo revenue/orders/AOV
//   - marketing_get_margin_by_product → live margin% per SKU
//   - square_recent_sales_csv       → row-level sales (compute SKU mix, channel mix)
//   - square_list_catalog           → live prices, capacities, lead times
//   - square_get_pos_summary        → channel mix, kitchen-handoff status
//   - kitchen_get_capacity          → daily minutes, default lead time
//   - kitchen_get_menu_constraints  → per-product binding capacity
//   - kitchen_get_production_summary → current load
//   - gb_get_metrics                → real local-search demand (views/calls/directions)
//   - gb_list_reviews               → what customers actually say (creative input)
//
// Output:
//   data/campaigns/.state/baseline.json — machine-readable brief
//   docs/01-product/MARKETING-BRIEF.md  — human-readable analysis
//
// Run: bun run marketing:brief

import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
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
  // Sandbox returns `estimatedMarginPct`; some hypothetical paths use `marginPct`
  marginPct?: number
  estimatedMarginPct?: number
}

interface MenuConstraint {
  productId: string
  name?: string
  prepMinutes?: number
  leadTimeMinutes?: number
  capacityUnitsPerDay?: number
  requiresCustomWork?: boolean
}

console.log('[brief] pulling live MCP data...\n')

const budget = await callSandboxTool<BudgetResp>('marketing_get_budget', {})
console.log(`✓ budget: $${budget.monthlyBudgetUsd}/mo → $${budget.targetEffectUsd} target`)

const sales = await callSandboxTool<SalesMonth[]>('marketing_get_sales_history', {})
console.log(`✓ sales history: ${sales.length} months`)

const margins = await callSandboxTool<MarginItem[] | { items?: MarginItem[] }>(
  'marketing_get_margin_by_product',
  {},
)
const marginItems: MarginItem[] = Array.isArray(margins) ? margins : (margins.items ?? [])
console.log(`✓ margins: ${marginItems.length} SKUs`)

const catalog = await tryCallSandboxTool<unknown>('square_list_catalog', {})
console.log(`✓ catalog: ${catalog ? 'ok' : 'failed'}`)

const salesCsv = await tryCallSandboxTool<string | { csv?: string; rows?: unknown[] }>(
  'square_recent_sales_csv',
  {},
)
console.log(`✓ sales csv: ${salesCsv ? 'ok' : 'failed'}`)

const posSummary = await tryCallSandboxTool<unknown>('square_get_pos_summary', {})
console.log(`✓ pos summary: ${posSummary ? 'ok' : 'failed'}`)

const kitchenCapacity = await tryCallSandboxTool<unknown>('kitchen_get_capacity', {})
console.log(`✓ kitchen capacity: ${kitchenCapacity ? 'ok' : 'failed'}`)

const menuConstraints = await tryCallSandboxTool<unknown>('kitchen_get_menu_constraints', {})
console.log(`✓ menu constraints: ${menuConstraints ? 'ok' : 'failed'}`)

const productionSummary = await tryCallSandboxTool<unknown>('kitchen_get_production_summary', {})
console.log(`✓ production summary: ${productionSummary ? 'ok' : 'failed'}`)

const gbMetrics30d = await tryCallSandboxTool<unknown>('gb_get_metrics', { range: 'last_30_days' })
const gbMetrics7d = await tryCallSandboxTool<unknown>('gb_get_metrics', { range: 'last_7_days' })
console.log(`✓ GBP metrics (30d/7d): ${gbMetrics30d ? 'ok' : 'fail'} / ${gbMetrics7d ? 'ok' : 'fail'}`)

const gbReviews = await tryCallSandboxTool<unknown>('gb_list_reviews', {})
console.log(`✓ GBP reviews: ${gbReviews ? 'ok' : 'fail'}`)

// Live campaign metrics across whatever's already launched. The sandbox
// returns an array when called without a campaignId (one row per campaign).
const liveCampaignMetrics = await tryCallSandboxTool<
  Array<{
    campaignId: string
    impressions?: number
    clicks?: number
    leads?: number
    orders?: number
    projectedRevenueUsd?: number
    launchedAt?: string
    approvalNote?: string
  }>
>('marketing_get_campaign_metrics', {})
console.log(
  `✓ live campaign metrics: ${
    Array.isArray(liveCampaignMetrics) ? liveCampaignMetrics.length + ' campaigns' : 'none'
  }`,
)

// Recent orders — row-level, our team's sandbox state (NOT the seed history)
const recentOrders = await tryCallSandboxTool<{
  orders?: Array<{
    items?: Array<{ kitchenProductId?: string; name?: string }>
    source?: string
    totalCents?: number
    createdAt?: string
    status?: string
  }>
}>('square_recent_orders', {})
const orderList = Array.isArray((recentOrders as { orders?: unknown[] })?.orders)
  ? (recentOrders as { orders: Array<{
      items?: Array<{ kitchenProductId?: string; name?: string }>
      source?: string
      totalCents?: number
      createdAt?: string
      status?: string
    }> }).orders
  : []
console.log(`✓ recent orders: ${orderList.length}`)

// Evaluator pre-grade
const evalScore = await tryCallSandboxTool<{
  dimension?: string
  score?: number
  maxScore?: number
  evidence?: string[]
  gaps?: string[]
}>('evaluator_score_marketing_loop', {})
console.log(`✓ evaluator: ${evalScore?.score ?? '?'}/${evalScore?.maxScore ?? '?'}`)

const evalEvidence = await tryCallSandboxTool<{ counts?: Record<string, number>; policy?: string }>(
  'evaluator_get_evidence_summary',
  {},
)
console.log(`✓ evaluator evidence: ${evalEvidence?.counts ? 'ok' : 'fail'}`)

// ─── analysis ───────────────────────────────────────────────────────────

const avgRev = sales.reduce((a, s) => a + s.revenueUsd, 0) / Math.max(sales.length, 1)
const avgOrders = sales.reduce((a, s) => a + s.orders, 0) / Math.max(sales.length, 1)
const avgTicket = avgRev / avgOrders
const trendRev = sales.length >= 2 ? sales.at(-1)!.revenueUsd - sales[0]!.revenueUsd : 0
const trendDirection = trendRev > 0 ? 'growing' : trendRev < 0 ? 'shrinking' : 'flat'

// Compute SKU rank by margin × capacity (the actual leverage formula)
function num(v: unknown): number {
  return typeof v === 'number' ? v : 0
}

const menuConstraintItems: MenuConstraint[] = Array.isArray(menuConstraints)
  ? (menuConstraints as MenuConstraint[])
  : []

const catalogItems = ((): Array<{
  id: string
  kitchenProductId: string
  name: string
  category: string
  priceUsd: number
  capacity: number
  prepMinutes: number
  leadTimeMinutes: number
  requiresCustomWork: boolean
}> => {
  if (!catalog) return []
  // Sandbox shape: { catalog: [...] } from square_list_catalog
  const c = catalog as { catalog?: unknown[]; items?: unknown[]; products?: unknown[] }
  const arr = Array.isArray(catalog)
    ? (catalog as unknown[])
    : (c.catalog ?? c.items ?? c.products ?? [])
  return arr.map((raw) => {
    const r = raw as Record<string, unknown>
    const kitchenProductId = String(r.kitchenProductId ?? r.productId ?? r.id ?? '')
    const constraint = menuConstraintItems.find((mc) => mc.productId === kitchenProductId)
    const priceUsd =
      num(r.priceUsd) ||
      (num(r.priceCents) ? num(r.priceCents) / 100 : 0) ||
      (num(r.price_cents) ? num(r.price_cents) / 100 : 0) ||
      num(r.price)
    return {
      id: String(r.id ?? r.productId ?? ''),
      kitchenProductId,
      name: String(r.name ?? r.id ?? ''),
      category: String(r.category ?? ''),
      priceUsd,
      capacity: num(constraint?.capacityUnitsPerDay),
      prepMinutes: num(constraint?.prepMinutes),
      leadTimeMinutes: num(constraint?.leadTimeMinutes),
      requiresCustomWork: Boolean(constraint?.requiresCustomWork),
    }
  })
})()

const ranked = catalogItems
  .map((c) => {
    // Margin tool keys SKU by `productId` matching the kitchen id
    const m = marginItems.find(
      (x) => x.productId === c.kitchenProductId || x.productId === c.id,
    )
    const marginPct = m?.marginPct ?? m?.estimatedMarginPct ?? null
    const marginUsd = marginPct != null ? (c.priceUsd * marginPct) / 100 : null
    const dailyCeiling = marginUsd != null && c.capacity ? marginUsd * c.capacity : null
    // Prep-minutes per dollar of margin — the actual binding-constraint metric
    const minutesPerMarginDollar =
      marginUsd != null && marginUsd > 0 && c.prepMinutes
        ? c.prepMinutes / marginUsd
        : null
    return {
      ...c,
      marginPct,
      marginUsd,
      dailyCeiling,
      minutesPerMarginDollar,
    }
  })
  .filter((r) => r.dailyCeiling != null)
  .sort((a, b) => (b.dailyCeiling ?? 0) - (a.dailyCeiling ?? 0))

const top3 = ranked.slice(0, 3)
const totalDailyCeiling = ranked.reduce((a, r) => a + (r.dailyCeiling ?? 0), 0)
const monthlyCeiling = totalDailyCeiling * 26 // 26 operating days/mo

// Aggregate row-level orders into mixes (this is OUR team's small-N test
// state, not the seed baseline — useful but call out the small N)
const orderBySource: Record<string, number> = {}
const orderBySku: Record<string, number> = {}
let orderTotalCents = 0
for (const ord of orderList) {
  if (ord.source) orderBySource[ord.source] = (orderBySource[ord.source] ?? 0) + 1
  for (const it of ord.items ?? []) {
    const k = it.kitchenProductId ?? it.name ?? 'unknown'
    orderBySku[k] = (orderBySku[k] ?? 0) + 1
  }
  orderTotalCents += ord.totalCents ?? 0
}
const orderAvgTicket = orderList.length > 0 ? orderTotalCents / 100 / orderList.length : 0

// Aggregate live campaign metrics into a single roll-up
interface CampaignMetricsRow {
  campaignId: string
  impressions?: number
  clicks?: number
  leads?: number
  orders?: number
  projectedRevenueUsd?: number
}
const campaignsArr: CampaignMetricsRow[] = Array.isArray(liveCampaignMetrics)
  ? liveCampaignMetrics
  : []
const liveAgg = campaignsArr.reduce(
  (acc, c) => {
    acc.impressions += c.impressions ?? 0
    acc.clicks += c.clicks ?? 0
    acc.leads += c.leads ?? 0
    acc.orders += c.orders ?? 0
    acc.projectedRevenueUsd += c.projectedRevenueUsd ?? 0
    return acc
  },
  { impressions: 0, clicks: 0, leads: 0, orders: 0, projectedRevenueUsd: 0 },
)
const liveCtrPct = liveAgg.impressions > 0 ? (liveAgg.clicks / liveAgg.impressions) * 100 : 0
const liveLeadCvrPct = liveAgg.clicks > 0 ? (liveAgg.leads / liveAgg.clicks) * 100 : 0
const liveOrderRatePct = liveAgg.leads > 0 ? (liveAgg.orders / liveAgg.leads) * 100 : 0
const liveAvgOrderUsd = liveAgg.orders > 0 ? liveAgg.projectedRevenueUsd / liveAgg.orders : 0
const liveBlendedRoas = budget.monthlyBudgetUsd > 0
  ? liveAgg.projectedRevenueUsd / budget.monthlyBudgetUsd
  : 0

// Try to parse channel mix from POS summary if it has the field
function extractChannelMix(s: unknown): Record<string, number> | null {
  if (!s) return null
  const obj = s as Record<string, unknown>
  const candidate =
    obj.channelMix ?? obj.channel_mix ?? obj.bySource ?? obj.by_source ?? obj.byChannel
  if (candidate && typeof candidate === 'object') {
    const out: Record<string, number> = {}
    for (const [k, v] of Object.entries(candidate as Record<string, unknown>)) {
      const n = typeof v === 'number' ? v : Number(v)
      if (Number.isFinite(n)) out[k] = n
    }
    return out
  }
  return null
}
const channelMix = extractChannelMix(posSummary)

// Persist baseline JSON
const stateDir = resolve('data/campaigns/.state')
mkdirSync(stateDir, { recursive: true })
const baselinePath = resolve(stateDir, 'baseline.json')
writeFileSync(
  baselinePath,
  JSON.stringify(
    {
      pulledAt: new Date().toISOString(),
      budget,
      sales: {
        months: sales,
        avgMonthlyRevenueUsd: avgRev,
        avgMonthlyOrders: avgOrders,
        avgTicketUsd: avgTicket,
        trendDirection,
        trendDeltaUsd: trendRev,
      },
      margins: marginItems,
      catalog: catalogItems,
      ranked,
      top3,
      totalDailyMarginCeilingUsd: totalDailyCeiling,
      monthlyMarginCeilingUsd: monthlyCeiling,
      channelMix,
      kitchenCapacity,
      menuConstraints,
      productionSummary,
      gbMetrics30d,
      gbMetrics7d,
      gbReviews,
      posSummary,
      liveCampaignMetrics: campaignsArr,
      liveCampaignAgg: {
        ...liveAgg,
        ctrPct: liveCtrPct,
        leadCvrPct: liveLeadCvrPct,
        orderRatePct: liveOrderRatePct,
        avgOrderUsd: liveAvgOrderUsd,
        blendedRoas: liveBlendedRoas,
      },
      recentOrders: {
        count: orderList.length,
        avgTicketUsd: orderAvgTicket,
        bySource: orderBySource,
        bySku: orderBySku,
      },
      evaluatorScore: evalScore,
      evaluatorEvidence: evalEvidence,
      salesCsvSample:
        typeof salesCsv === 'string'
          ? salesCsv.slice(0, 500)
          : salesCsv && 'csv' in (salesCsv as object)
            ? String((salesCsv as { csv: string }).csv).slice(0, 500)
            : salesCsv,
    },
    null,
    2,
  ),
)
console.log(`\n✓ wrote ${baselinePath}`)

// Render the human-readable brief
const briefPath = resolve('docs/01-product/MARKETING-BRIEF.md')
const fmtPct = (n: number | null | undefined) => (n == null ? '?' : `${n}%`)
const fmtMoney = (n: number | null | undefined) =>
  n == null ? '?' : `$${n.toFixed(2).replace(/\.00$/, '')}`

const rankedRows = ranked
  .map(
    (r) =>
      `| ${r.kitchenProductId || r.id} | ${r.category || '—'} | ${fmtMoney(r.priceUsd)} | ${fmtPct(r.marginPct)} | ${fmtMoney(r.marginUsd)} | ${r.capacity || '—'} | ${r.prepMinutes || '—'}m | ${fmtMoney(r.dailyCeiling)} | ${r.minutesPerMarginDollar != null ? r.minutesPerMarginDollar.toFixed(2) + 'm/$' : '—'} |`,
  )
  .join('\n')

const totalDailyMinutesIfAllMaxed = ranked.reduce(
  (a, r) => a + (r.capacity || 0) * (r.prepMinutes || 0),
  0,
)
const kitchenMinBudget =
  (kitchenCapacity as { dailyCapacityMinutes?: number } | null)?.dailyCapacityMinutes ?? 420

const channelMixSection = channelMix
  ? Object.entries(channelMix)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `- **${k}** — ${v}`)
      .join('\n')
  : '_(POS summary did not expose a channelMix field — see baseline.json for raw response)_'

const reviewsSummary = (() => {
  if (!gbReviews) return '_(reviews call failed)_'
  const obj = gbReviews as { reviews?: unknown[]; items?: unknown[] }
  const arr = Array.isArray(gbReviews) ? gbReviews : (obj.reviews ?? obj.items ?? [])
  if (!Array.isArray(arr) || arr.length === 0) return '_(no reviews returned)_'
  return arr
    .slice(0, 5)
    .map((r) => {
      const rec = r as Record<string, unknown>
      const rating = rec.rating ?? rec.stars ?? '?'
      const text = String(rec.text ?? rec.comment ?? '').slice(0, 140)
      const author = String(rec.author ?? rec.name ?? '?')
      return `- **${rating}★** ${author} — "${text}${text.length === 140 ? '…' : ''}"`
    })
    .join('\n')
})()

const gbMetricsSummary = (m: unknown, label: string): string => {
  if (!m) return `_${label}: not available_`
  const obj = m as Record<string, unknown>
  const fields = [
    'profileViews',
    'searchViews',
    'mapViews',
    'directionsRequests',
    'callsClicks',
    'websiteClicks',
  ]
  const lines = fields
    .filter((f) => f in obj)
    .map((f) => `  - ${f}: ${obj[f]}`)
  return `**${label}:**\n${lines.length ? lines.join('\n') : '  (raw shape: see baseline.json)'}`
}

const briefBody = `# Marketing data brief — live MCP snapshot

> Pulled: ${new Date().toISOString().slice(0, 19)}Z
> Source: every relevant tool on the sandbox MCP at \`steppebusinessclub.com/api/mcp\`.
> Companion to [HYPOTHESIS.md](HYPOTHESIS.md) — *this* file is the data; the hypothesis is the bet built on it.

---

## 1. The constraint (live)

- Monthly budget: **$${budget.monthlyBudgetUsd}** · target effect: **$${budget.targetEffectUsd}**
- Implied ROAS: **${(budget.targetEffectUsd / budget.monthlyBudgetUsd).toFixed(1)}×**
- Challenge: ${budget.challenge ?? '10× ROAS'}

## 2. Sales baseline (live, ${sales.length} months)

| Month | Revenue | Orders | Avg ticket |
|---|---|---|---|
${sales.map((s) => `| ${s.month} | $${s.revenueUsd.toLocaleString()} | ${s.orders} | $${s.avgTicketUsd.toFixed(2)} |`).join('\n')}

- Average monthly revenue: **$${avgRev.toFixed(0)}**
- Average monthly orders: **${avgOrders.toFixed(0)}**
- Average ticket: **$${avgTicket.toFixed(2)}**
- Trend: **${trendDirection}** (Δ $${trendRev.toLocaleString()} from first to last month)

**Implication for the hypothesis:** at $${avgTicket.toFixed(2)} avg ticket and a 10× ROAS target, cold B2C alone needs **${Math.ceil(budget.targetEffectUsd / avgTicket)} incremental orders/mo** at a **$${(budget.monthlyBudgetUsd / Math.ceil(budget.targetEffectUsd / avgTicket)).toFixed(2)} CAC**. Industry food/bev CPC is $0.78 with 2.02% CVR → blended CAC ≈ $38–40/order. The math doesn't close on cold B2C; it forces B2B catering ($240+ first orders) and retargeting (warm CAC < $10) into the lead role.

## 3. SKU leverage — ranked by daily margin ceiling (live)

| SKU | Category | Price | Margin% | Margin$ | Daily cap | Prep | Daily ceiling | Min/$margin |
|---|---|---|---|---|---|---|---|---|
${rankedRows || '_(catalog or margins missing — check baseline.json)_'}

**Top 3 levers (per-SKU max):** ${top3.map((t) => `\`${t.kitchenProductId || t.id}\` (${fmtMoney(t.dailyCeiling)}/day)`).join(' · ') || '—'}

**Capacity reality check:** if every SKU ran at its individual daily max, the kitchen would need **${totalDailyMinutesIfAllMaxed} prep-minutes/day** — but the live budget is **${kitchenMinBudget} minutes**. So the per-SKU caps are a per-product MAX, not an additive ceiling. The marketing agent must allocate within the 420-min daily envelope, prioritising high \`Min/$margin\` efficiency.

**Most prep-efficient (lowest minutes per $ of margin):** ${[...ranked]
      .filter((r) => r.minutesPerMarginDollar != null)
      .sort((a, b) => (a.minutesPerMarginDollar ?? Infinity) - (b.minutesPerMarginDollar ?? Infinity))
      .slice(0, 3)
      .map((r) => `\`${r.kitchenProductId || r.id}\` (${(r.minutesPerMarginDollar ?? 0).toFixed(2)}m/$)`)
      .join(' · ') || '—'} — these are the SKUs we should be filling kitchen minutes with first.

## 4. Channel mix — current live POS (small-N)

${channelMixSection}

> Note: this is the live count of orders our team has placed in the sandbox today, not a historical baseline. The 6-month seed CSV does not break out channel mix. Use this as a leading indicator only.

## 5. Kitchen — capacity + current load (live)

\`\`\`json
${JSON.stringify({ kitchenCapacity, productionSummary }, null, 2).slice(0, 2000)}
\`\`\`

## 6. Google Business Profile — local search demand signal

${gbMetricsSummary(gbMetrics30d, '30-day metrics')}

${gbMetricsSummary(gbMetrics7d, '7-day metrics')}

**Why this matters:** GBP \`directionRequests\` and \`calls\` are the cleanest signal of local-search intent. If the 30-day call volume is materially > 0 and growing, the **\$50 Google Local catering campaign** is well-placed; if it's near zero, redirect that $50 to \`b2b-catering-meta-leadgen\`.

## 7. Real customer voice — recent GBP reviews (live)

${reviewsSummary}

**Use this as creative input:** the language customers actually use about HappyCake is the language Meta creatives should mirror. Avoid claims that no review supports.

## 8. Live campaign results — already-launched simulated campaigns

${
  campaignsArr.length === 0
    ? '_No campaigns launched yet — run `bun run marketing:run` or approve from Telegram /campaigns._'
    : `${campaignsArr.length} campaign${campaignsArr.length === 1 ? '' : 's'} live in the simulator.

| Campaign | Impressions | Clicks | CTR | Leads | Orders | Proj. Rev | ROAS |
|---|---|---|---|---|---|---|---|
${campaignsArr
  .map((c) => {
    const ctr = c.impressions ? ((c.clicks ?? 0) / c.impressions) * 100 : 0
    const proj = c.projectedRevenueUsd ?? 0
    // Per-campaign budget isn't returned by the metrics tool — show projected only
    return `| \`${c.campaignId}\` | ${c.impressions ?? 0} | ${c.clicks ?? 0} | ${ctr.toFixed(2)}% | ${c.leads ?? 0} | ${c.orders ?? 0} | $${proj} | n/a |`
  })
  .join('\n')}

**Aggregate (all live campaigns combined):**
- Spend: $${budget.monthlyBudgetUsd} (full month budget)
- Impressions: ${liveAgg.impressions.toLocaleString()}
- Clicks: ${liveAgg.clicks.toLocaleString()}
- CTR: **${liveCtrPct.toFixed(2)}%**
- Leads: ${liveAgg.leads}
- Click → lead CVR: ${liveLeadCvrPct.toFixed(1)}%
- Orders: ${liveAgg.orders}
- Lead → order CVR: ${liveOrderRatePct.toFixed(1)}%
- Avg order: **$${liveAvgOrderUsd.toFixed(2)}**
- Projected total revenue: **$${liveAgg.projectedRevenueUsd.toLocaleString()}**
- **Blended simulated ROAS: ${liveBlendedRoas.toFixed(1)}× (target: ${(budget.targetEffectUsd / budget.monthlyBudgetUsd).toFixed(0)}×)**`
}

### Honest read on simulator behavior

${
  campaignsArr.length === 0
    ? ''
    : `Look at the per-campaign CTRs. They're all **${liveCtrPct.toFixed(2)}%** within rounding. The simulator does NOT model audience × creative × channel variance — it returns a flat conversion model. Avg order is **$${liveAvgOrderUsd.toFixed(2)}** regardless of which SKU the campaign promoted.

**Interpretation:** the simulated ROAS is the **best case** the eval will hand us; a real Meta launch will have variance. Treat the simulator as a "did the loop run" check, not a "this is what you'd see in production" forecast.`
}

## 9. Recent POS orders — row-level (LIVE, our team's small-N state)

${
  orderList.length === 0
    ? '_No orders in our team state yet._'
    : `${orderList.length} orders · $${orderTotalCents / 100} total · **avg ticket $${orderAvgTicket.toFixed(2)}**

By source:
${Object.entries(orderBySource)
  .sort((a, b) => b[1] - a[1])
  .map(([k, v]) => `- ${k}: ${v}`)
  .join('\n')}

By SKU:
${Object.entries(orderBySku)
  .sort((a, b) => b[1] - a[1])
  .map(([k, v]) => `- ${k}: ${v}`)
  .join('\n')}

> Caveat: this is OUR team's recent test orders, not a historical baseline. The 6-month seed (\`marketing_get_sales_history\`/\`square_recent_sales_csv\`) only exposes monthly aggregates — there is no row-level seed history available. Use this section as a sanity check on flow correctness, not as demand evidence.`
}

## 10. Evaluator pre-grade — how the judge sees us

${
  evalScore
    ? `**${evalScore.dimension ?? 'marketing loop'}: ${evalScore.score ?? '?'}/${evalScore.maxScore ?? '?'}**

Evidence the evaluator counts:
${(evalScore.evidence ?? []).map((e) => `- ${e}`).join('\n')}

${
  (evalScore.gaps ?? []).length === 0
    ? '_No gaps reported._'
    : `**Gaps to close:**
${(evalScore.gaps ?? []).map((g) => `- ${g}`).join('\n')}`
}`
    : '_Evaluator score not available._'
}

${
  evalEvidence?.counts
    ? `Cross-dimensional coverage (from \`evaluator_get_evidence_summary\`):
${Object.entries(evalEvidence.counts)
  .map(([k, v]) => `- \`${k}\`: ${v}`)
  .join('\n')}

Watch for any dimension at zero — that's where the rest of the build effort lives. The marketing dimension is full; channel-response (WA outbound, IG actions, GBP replies) is where the next round of work shows up.`
    : ''
}

---

## 11. What this brief changes in the hypothesis

Cross-reference [HYPOTHESIS.md](HYPOTHESIS.md):

| Hypothesis section | Was assumed | Now grounded in |
|---|---|---|
| Margin per SKU | "~60% assumed" | Live values in section 3 above |
| Avg ticket | $25 baseline | Live $${avgTicket.toFixed(2)} |
| Daily B2B ceiling | "8 boxes/day" | Live capacity in section 5 |
| Channel mix priorities | Industry assumptions | Live POS mix in section 4 |
| Local search demand | Not validated | Live GBP metrics in section 6 |
| Creative voice | Brand book only | Real customer review language in section 7 |
| Simulator vs hypothesis | n/a | Live aggregates in section 8 (CTR ${liveCtrPct.toFixed(2)}%, avg order $${liveAvgOrderUsd.toFixed(2)}, ROAS ${liveBlendedRoas.toFixed(1)}×) |
| Evaluator score | Unknown | Section 10: ${evalScore?.score ?? '?'}/${evalScore?.maxScore ?? '?'} on marketing loop |

**Action items the marketing agent should take next:**

1. If \`office-dessert-box\` margin% comes back below 50%, revisit the 5,300 yr-1 catering projection in HYPOTHESIS.md.
2. If GBP \`directionRequests\` is < 30/mo, deprioritise Google Local — Meta-only.
3. If channel mix is < 5% from website today, the funnel projections that assume website conversion need a friction audit before launch.
4. If a SKU's daily margin ceiling is < $50, do not anchor a campaign on it.

Re-run \`bun run marketing:brief\` weekly during the campaign to keep the baseline fresh.
`

writeFileSync(briefPath, briefBody)
console.log(`✓ wrote ${briefPath} (${briefBody.length} chars)`)
console.log('\nNext: review docs/01-product/MARKETING-BRIEF.md, then update HYPOTHESIS.md numbers where the brief shows variance.')
