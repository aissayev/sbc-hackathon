# $500 → $5,000 — HappyCake US marketing hypothesis

**For:** the owner reviewing in Telegram + an AI agent reading cold.
**Companion files:** [plans.json](../../data/campaigns/plans.json) (machine-readable plan) · [MARKETING-BRIEF.md](MARKETING-BRIEF.md) (live MCP brief, regen with `bun run marketing:brief`).

---

## At a glance (60-second read)

- **The bet:** $500/mo ad spend returns $5,000/mo attributable revenue (10× ROAS).
- **The rule:** $500 deploys to **ONE strategy**, not split across 5 channels. Splitting = $100/channel = below every channel's learning threshold.
- **The pick:** **B2B Catering Offensive.** $100 CAC, $144 first-order margin → **payback within the first order**, **8.6× LTV:CAC at year-1**, **21× at year-3**. Other strategies don't clear the bar.
- **The risk:** if month-1 CTR < 1.0% AND CPL > $40 across the strategy, kill and switch to B2C Anchor.
- **The asset:** organic + newsletter + GBP run alongside (zero $, 8–12 hr/wk effort) — by month 6 they deliver ~$5k/yr more revenue at zero ad cost.

| Strategy | $/mo | Yr-1 cumulative ROAS | Pick? |
|---|---|---|---|
| **B2B Catering Offensive** | $500 | **9.3× by m6** | ✅ |
| B2C Anchor + Retargeting | $500 | 6.3× by m6 | Fallback / seasonal |
| Local Awareness Walk-in | $500 | 3.6× plateau | ⚠ FOH-speed risk |
| Custom Cakes Premium | $500 | 2.5× plateau | ❌ Capacity-bound |
| Always-on Organic | $0 + 10 hr/wk | n/a | ✅ Always |

---

## How to read every number in this doc

| Tag | Meaning | Example |
|---|---|---|
| **LIVE** | Pulled from sandbox MCP at last brief run. Source tool listed in [§Data sources](#data-sources). | LIVE: 60% margin |
| **INDUSTRY** | Public benchmark (May 2026). Source cited in [plans.json](../../data/campaigns/plans.json) → `industryBenchmarks`. | INDUSTRY: 1.4% CTR |
| **OUR EST.** | Our hypothesis built from LIVE + INDUSTRY. Validated only after first $50 of real spend. | OUR EST.: 5 first orders |
| **OUR PROPOSAL** | Something we suggest creating that doesn't exist in the live catalog yet. | OUR PROPOSAL: Sampler Box $48 |

---

## What HappyCake has today (LIVE)

These 5 SKUs are what the sandbox actually models (`marketing_get_margin_by_product` + `kitchen_get_menu_constraints`). The website seed has 5 more (cloud-cake-slice, tiramisu, chak-chak, truffle-bites, morning-pastry-mix) that render on /menu but the simulator doesn't score.

| SKU | Price | Margin% | Margin$ | Prep min | Cap/day | Daily ceiling | Min/$margin |
|---|---|---|---|---|---|---|---|
| `office-dessert-box` (catering) | $120 | 60% | $72 | 45 | 8 | $576 | **0.63** ⭐ |
| `honey-cake-slice` | $8.50 | 68% | $5.78 | 3 | 80 | $462 | **0.52** ⭐ |
| `whole-honey-cake` | $55 | 62% | $34 | 25 | 12 | $409 | 0.73 |
| `custom-birthday-cake` | $95 | 58% | $55 | 90 | 4 | $220 | 1.63 |
| `pistachio-roll` | $9.50 | 64% | $6 | 8 | 30 | $182 | 1.32 |

**Kitchen constraint (LIVE):** 420 min/day total. The per-SKU caps are individual MAXes, not additive — at full caps the kitchen would need 1,500 min. So real allocation must fit inside 420.

**Read:** `office-dessert-box` and `honey-cake-slice` are the most kitchen-minute-efficient (lowest min/$margin). The catering offensive is built on this.

---

## What we suggest creating (OUR PROPOSAL)

A single $120 entry point is a high commitment for a first-time B2B buyer. We suggest a **tiered ladder** of 4 new SKUs built on the existing 5. None of these exist in the live catalog yet — they're our proposal for the campaign.

| SKU (new unless tagged) | Tier | Retail | Composition (built on existing) | Margin% | Margin$ | Role |
|---|---|---|---|---|---|---|
| **Sampler Box** | Entry | **$48** | 3× honey slice + 2× pistachio + 1× tiramisu | 60% | $29 | Trial — 4-person team taste test |
| Office Dessert Box (existing) | Core | $120 | (no change) | 60% | $72 | Workhorse — 8–10 person team |
| **Big Day Box** | Premium | **$185** | 12 slices + 1 cake "Honey" + chak-chak + truffles | 58% | $107 | Upsell — 18+ ppl, holidays, realtor closings |
| **Hotel Welcome Set** | ICP-specific | **$95** | 8 slices in branded packaging | 55% | $52 | Hotel concierge / in-room amenity |
| **Weekly Corp. Subscription** | Highest LTV | **$108/wk** | Office Box × 0.9 (sub discount) | 56% | $60/wk | Recurring — converts one-off to ~$5,200/yr/account |

**Pricing build-up logic** (so the owner can sanity-check):
- Sampler Box: 6 slices × $8.50 = $51 raw → $48 retail (small bundle nudge to drive trial)
- Big Day Box: $51 (slices) + $51 (more slices) + $55 (whole) + $7 (chak) + $7.50 (truffles) = $171.50 raw → $185 retail (premium positioning + branded box)
- Hotel Welcome: 8 × $8.50 = $68 + $10 packaging cost = $78 raw → $95 retail (concierge-grade premium)
- Subscription: $120 × 0.9 × 4 wk = $432/mo recurring per subscriber

**Capacity check** (we don't oversell what the kitchen can deliver):
- Sampler Box: ~10/day (limited by slice availability)
- Big Day Box: 4/day (limited by 12/day whole-cake cap)
- Hotel Welcome Set: 8/day baseline
- Subscription: caps at ~6 active subs (each consumes 1 Office Box slot/wk; 8 slots × 5 days / 4 wk = 10 max, reserve buffer for one-offs)

**Why this matters for $500 → $5,000:** the subscription alone, at 6 active accounts × $432/mo = $2,592/mo recurring revenue, gets us 50%+ of the way to the target with zero new acquisition.

> **Owner action required before launch:** these 4 new SKUs need to be created in Square POS + added to `/api/products` (the website surface). The campaign creative leads with the Sampler/Office tiers as the entry CTA.

---

## The recommended strategy: B2B Catering Offensive

**Full $500/mo deploys here.** No splitting.

### Allocation

| Sub-channel | M1 | M2 | M3 | M6 |
|---|---|---|---|---|
| Meta B2B Lead Gen — broad-net | $400 | — | — | — |
| Meta B2B Lead Gen — winners | — | $300 | — | — |
| Meta lookalikes | — | — | $250 | $200 |
| Meta retargeting (warm pool) | — | $100 | $150 | $200 |
| Google Local — catering intent | $100 | $100 | $100 | $100 |

### ICP (5 segments)

1. Office managers / EAs · 30–300 person Sugar Land + Energy Corridor offices · ~85k matched in Meta
2. Boutique hotels & extended-stay (welcome amenity, in-room gifting)
3. Independent coffee shops (wholesale slice supply)
4. Event planners + realtors (closing gifts, milestone events)
5. Medical / dental offices (patient appreciation)

### CAC / LTV / payback math

| Metric | Value | Source |
|---|---|---|
| Month-1 ad spend | $500 | constraint |
| Acquired accounts (m1) | 5 | OUR EST. (sensitivity table below) |
| **CAC per account** | **$100** | $500 / 5 |
| Industry CAC benchmark | $84 (B2B Meta avg) – $99 (food/bev lead-gen × 4.5 lead→account) | INDUSTRY |
| Avg first order | $240 | OUR EST. (Office Box w/ Big Day upsell) |
| First-order margin% | 60% | LIVE (`marketing_get_margin_by_product`) |
| First-order margin$ | $144 | $240 × 60% |
| **Payback** | **0.69 first orders** = **same first order** | $100 CAC < $144 margin |
| Yr-1 reorders/account | 5.5 | INDUSTRY (catering corp 25%+ retention; cohort orders ~6×/yr) |
| Yr-1 revenue/account | $1,440 | $240 × 6 (incl. first order) |
| Yr-1 margin/account | $864 | × 60% |
| **LTV:CAC (yr-1)** | **8.6×** | $864 / $100 |
| 3-yr revenue/account (80%/80% retention) | $3,514 | OUR EST. |
| 3-yr margin/account | $2,108 | × 60% |
| **LTV:CAC (3-yr)** | **21×** | $2,108 / $100 |

> **Industry rule of thumb:** "Excellent" SaaS-style is 5:1 LTV:CAC. We project 8.6:1 on year-1 alone — strong even before retention compounds.

### Attribution model (cake-industry standard)

| Channel | Share | What it captures |
|---|---|---|
| Direct click-through | 30% | Clicked ad → site → ordered same session |
| View-through | 40% | Saw ad in last 7d → ordered later |
| Branded search | 20% | Ad-driven awareness → typed URL or searched "happycake sugar land" |
| Phone call | 10% | Geo-targeted ad → branded search → call (`gb_get_metrics.callsClicks` proxy) |

### 6-month rollout

| Phase | Spend | Target outcomes |
|---|---|---|
| **M1 — Test breadth** | $500 | 6 ad sets × 4 creatives = 24 ads. 33k imps · 460 clicks · 32 leads · 9 SQLs · **5 first orders / $1,200 rev** |
| **M2 — Concentrate winners** | $500 | Pause kills, top 2 sets get 70%. Retargeting layer launches. 50 leads, 9 first + 3 reorders. **$2,400 mo / $3,600 cum** |
| **M3 — Scale lookalikes** | $500 | 1% lookalike off purchaser list. 13 first + 8 reorders. **$4,400 mo / $8,000 cum / 5.3× cum ROAS** |
| **M6 — Compounding** | $500 | Repeat-cycle is the engine. **$7,500 mo / $28,000 cum / 9.3× cum ROAS / 55 acquired / 38 active** |

### Kill / scale rules

- **Kill ad set:** CTR < 1.0% after $50 OR CPL > $35 after $50
- **Scale ad set:** CPL < $20 AND SQL rate > 25% over 50 leads → +50% daily budget
- **Pivot strategy:** if blended CTR < 0.8% AND CPL > $40 after $250 cumulative → switch to B2C Anchor

### Sensitivity (what breaks the bet)

| Scenario | M1 first orders | Yr-1 rev/account cohort | Verdict |
|---|---|---|---|
| Top quartile (CTR 2%, CVR 12%, close 70%) | 12 | $17,200 | 3× over target |
| **Expected** | **5** | **$6,800** | **Clears target** |
| CTR halved | 2 | $2,640 | Misses |
| CPL doubled | 2 | $2,640 | Misses |
| Both halved | 0.6 | $725 | Catastrophic — kill |

**Break-even spend:** $235/mo on Meta B2B is the minimum that returns $5k yr-1 at expected case → $15 of headroom on the $400 Meta allocation.

---

## Alternatives — when to pick instead

**B2C Anchor + Retargeting Flywheel** ($500/mo) — pick if catering proves saturated, or before a major seasonal window (Mother's, Valentine's). CAC $17.86 (industry $38–40), payback in first order, 4.7× yr-1 LTV:CAC, **6.3× cumulative ROAS by month 6**. Kill if m1 cold CAC > $35.

**Local Awareness Walk-in** — flagged for completeness; **don't pick** until rev_003 ("waited 25 min for one slice") FOH-speed issue is fixed. Surging walk-ins makes that worse.

**Custom Cakes Premium** — capacity is binding (4/day × 90 min/cake). Caps at 2.5× ROAS. **Don't pick.**

---

## Always-on Organic ($0 ads, 8–12 hr/wk effort)

Runs in parallel with whichever paid strategy is picked. Lowers blended CAC every month it runs.

- **Local SEO:** 8 evergreen pages in m1–m2 (catering FAQ, delivery zones, allergen guide, birthday-cake size guide, hotel amenity menu, honey origin story, gluten-aware options, custom-cake pricing). Add `LocalBusiness`, `Bakery`, `Menu` schema.
- **Newsletter:** 3.5% site-capture + counter QR. Birthday-club ("free first slice on your birthday"). By m6: ~600 subs → 18% yr-1 conversion → ~$5,200/yr earned revenue at $0 spend.
- **GBP content:** weekly `gb_simulate_post`, reply every review (`gb_simulate_reply`) within 48h.

| M | Done |
|---|---|
| 1 | 8 pages drafted, schema validated, newsletter + QR live (~30h) |
| 3 | First long-tail rankings, list ~250 |
| 6 | Page-1 on 3–5 queries, list ~600, ~25 organic-attributed orders/mo |

---

## Live MCP signals that justify the bet

These four signals — none of them speculative — are why B2B catering wins.

1. **Margin × repeat × first-order value (LIVE):** Only catering needs ~5 wins to clear $5k yr-1. Every other SKU needs 35–95 wins.
2. **Real review validates the ICP (LIVE `gb_list_reviews`):** rev_004 — *"We've been ordering from HappyCake for our office birthdays for months. Never disappointed."* — A real customer is already doing the use-case at high cadence.
3. **Local-search demand is real (LIVE `gb_get_metrics`, 30d):** 87 direction requests + 41 calls = ~128 high-intent local actions/mo. Sizes the $100 Google Local sub-allocation correctly.
4. **Delivery is undermarketed (LIVE `gb_list_reviews`):** rev_002 — *"Wish you delivered."* — Customers don't know we deliver. Every B2B creative leads with **"free first delivery within 5 mi."**

---

## Risks that invalidate this plan

| Risk | Signal | Action |
|---|---|---|
| B2B SQL rate < 15% | Strategy 1 m1 leads convert poorly | Pivot to B2C Anchor |
| Catering capacity binding | `kitchen_get_production_summary` shows 8/8 daily | Cap budget; route overflow to month-out |
| FOH still slow | New 1–2★ reviews on wait time | Don't run Local Awareness even if owner asks |
| Margin lower than LIVE | Office Box drops below 50% | Re-run yr-1 math |
| Subscription doesn't sell | < 1 sub by m3 | Drop subscription tier; keep one-off catering |

---

## Honesty about what we don't know

Until the chosen strategy spends $50 in market, every CTR/CPL/CVR is OUR EST. anchored on LIVE + INDUSTRY. The first $50 buys data, not bookings.

The simulator's `marketing_get_campaign_metrics` returns flat 4.20% CTR / $42 avg order regardless of SKU/channel — that's a sandbox artifact. In production, expect variance and the median row of the sensitivity table. The point of this plan is **structural confidence** (B2B math closes the bet at expected case; alternatives are explicit) — not pretend precision.

---

## Data sources {#data-sources}

| Number type | Source tool / file |
|---|---|
| Margin% per SKU | `mcp__happycake__marketing_get_margin_by_product` (live) |
| Prep minutes / capacity per day per SKU | `mcp__happycake__kitchen_get_menu_constraints` (live) |
| Kitchen daily-minute budget (420) | `mcp__happycake__kitchen_get_capacity` (live) |
| 6-month sales baseline | `mcp__happycake__marketing_get_sales_history` (live) |
| GBP demand (87 directions, 41 calls / 30d) | `mcp__happycake__gb_get_metrics` (live) |
| Customer review quotes | `mcp__happycake__gb_list_reviews` (live) |
| Daily margin ceiling per SKU | computed: `priceUsd × marginPct × capacityPerDay` |
| Min/$margin (efficiency) | computed: `prepMinutes / (priceUsd × marginPct)` |
| CTR / CPM / CPL / CPC benchmarks | INDUSTRY: WordStream, Triple Whale, AdAmigo (May 2026); cited in [plans.json](../../data/campaigns/plans.json) `industryBenchmarks` |
| Repeat cadence (5.5/yr corp catering) | INDUSTRY: PeopleLinx catering LTV guide |
| Retention assumptions (80/80, 60/50) | OUR EST., conservative against industry |
| New SKU prices (Sampler/Big Day/Hotel/Subscription) | OUR PROPOSAL — built up from LIVE existing-SKU prices, see [plans.json](../../data/campaigns/plans.json) `suggestedNewSkus` |

Refresh all LIVE numbers: `bun run marketing:brief` (calls 14 sandbox tools in one pass).

---

## How the system runs this

| What | Where |
|---|---|
| Pick a strategy (owner) | Telegram `/campaigns` → ⭐ B2B Catering tap → "Approve & Launch" |
| Pick from CLI | `bun run marketing:run --strategy b2b-catering-offensive` |
| Refresh live data | `bun run marketing:brief` (writes [MARKETING-BRIEF.md](MARKETING-BRIEF.md), gitignored) |
| See live metrics | Telegram `/brief` (reads cached baseline) or `/campaigns` → strategy → "Read metrics" |
| Loop closure (weekly) | `marketing_get_campaign_metrics` → compare to expected-case row → `marketing_adjust_campaign` → `marketing_report_to_owner` |
| Single-strategy enforcement | Telegram refuses double-launch with explanation |
