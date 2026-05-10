# $500 → $5,000 — HappyCake US marketing hypothesis

A marketing plan for a $500/month ad budget targeting $5,000/month in attributable revenue. Designed to be reviewed by the owner from Telegram and executed by the agent system without further translation.

Companion files: [plans.json](../../data/campaigns/plans.json) (machine-readable plan) · [MARKETING-BRIEF.md](MARKETING-BRIEF.md) (live MCP data brief, refreshed by `bun run marketing:brief`).

---

## At a glance

- **The bet.** $500/mo ad spend returns $5,000/mo in attributable revenue — a 10× ROAS challenge.
- **The deployment rule.** The full $500 goes to a single strategy. Splitting it five ways yields ~$100/channel, which sits below every channel's learning threshold and produces no signal.
- **The recommendation.** B2B Catering Offensive — $100 CAC against $144 first-order margin means payback inside the first order, 8.6× LTV:CAC at year one, 21× at year three. The other strategies don't clear the bar.
- **The downside.** If month-1 CTR drops below 1.0% and CPL exceeds $40 across the strategy, pause and pivot to B2C Anchor.
- **The compounding asset.** Organic content, newsletter, and Google Business Profile run alongside the paid strategy (no ad spend, ~10 hr/wk of effort). By month six they contribute roughly $5k/yr at zero acquisition cost.

| Strategy | $/mo | Yr-1 cumulative ROAS | Pick? |
|---|---|---|---|
| **B2B Catering Offensive** | $500 | **9.3× by m6** | ✅ |
| B2C Anchor + Retargeting | $500 | 6.3× by m6 | Fallback / seasonal |
| Local Awareness Walk-in | $500 | 3.6× plateau | ⚠ FOH-speed risk |
| Custom Cakes Premium | $500 | 2.5× plateau | ❌ Capacity-bound |
| Always-on Organic | $0 + 10 hr/wk | n/a | ✅ Always |

---

## Reading the numbers

Every figure in this document carries one of four provenance tags:

| Tag | Meaning | Example |
|---|---|---|
| **LIVE** | Pulled from the sandbox MCP at the last brief refresh. Origin tool listed under [Data sources](#data-sources). | LIVE: 60% margin |
| **INDUSTRY** | Public benchmark (May 2026). Citations in [plans.json](../../data/campaigns/plans.json) → `industryBenchmarks`. | INDUSTRY: 1.4% CTR |
| **OUR EST.** | A modeled estimate built on LIVE and INDUSTRY inputs. Confirmed only after the first $50 of real spend. | OUR EST.: 5 first orders |
| **OUR PROPOSAL** | A new SKU or program proposed for the campaign and not yet in the live catalog. | OUR PROPOSAL: Sampler Box $48 |

---

## Existing catalog (LIVE)

Five SKUs are modeled by the sandbox via `marketing_get_margin_by_product` and `kitchen_get_menu_constraints`. The website seed includes five additional items (cloud-cake-slice, tiramisu, chak-chak, truffle-bites, morning-pastry-mix) that render on /menu but are not scored by the simulator and are excluded from this analysis.

| SKU | Price | Margin% | Margin$ | Prep min | Cap/day | Daily ceiling | Min/$margin |
|---|---|---|---|---|---|---|---|
| `office-dessert-box` (catering) | $120 | 60% | $72 | 45 | 8 | $576 | **0.63** ⭐ |
| `honey-cake-slice` | $8.50 | 68% | $5.78 | 3 | 80 | $462 | **0.52** ⭐ |
| `whole-honey-cake` | $55 | 62% | $34 | 25 | 12 | $409 | 0.73 |
| `custom-birthday-cake` | $95 | 58% | $55 | 90 | 4 | $220 | 1.63 |
| `pistachio-roll` | $9.50 | 64% | $6 | 8 | 30 | $182 | 1.32 |

**Kitchen capacity (LIVE):** 420 production minutes per day. Per-SKU caps are individual maxima rather than additive — running every SKU at its individual cap would require 1,500 minutes — so the active campaign mix must fit inside the 420-minute envelope.

**Highest-leverage SKUs:** `office-dessert-box` and `honey-cake-slice` show the lowest minutes-per-margin-dollar. The recommended catering offensive is anchored on this efficiency.

---

## Proposed new SKUs (OUR PROPOSAL)

A single $120 entry point is a high commitment for a first-time B2B buyer. The recommendation is to introduce a **tiered offer ladder** — four new SKUs composed from existing inventory items — to broaden the funnel and capture both trial-stage and high-LTV demand. None of the four currently exist in the live catalog.

| SKU (new unless tagged) | Tier | Retail | Composition (built on existing) | Margin% | Margin$ | Role |
|---|---|---|---|---|---|---|
| **Sampler Box** | Entry | **$48** | 3× honey slice + 2× pistachio + 1× tiramisu | 60% | $29 | Trial — 4-person team taste test |
| Office Dessert Box (existing) | Core | $120 | (no change) | 60% | $72 | Workhorse — 8–10 person team |
| **Big Day Box** | Premium | **$185** | 12 slices + 1 cake "Honey" + chak-chak + truffles | 58% | $107 | Upsell — 18+ ppl, holidays, realtor closings |
| **Hotel Welcome Set** | ICP-specific | **$95** | 8 slices in branded packaging | 55% | $52 | Hotel concierge / in-room amenity |
| **Weekly Corp. Subscription** | Highest LTV | **$108/wk** | Office Box × 0.9 (sub discount) | 56% | $60/wk | Recurring — converts one-off to ~$5,200/yr/account |

**Pricing build-up:**
- Sampler Box: 6 slices × $8.50 = $51 cost-equivalent → $48 retail (slight bundle discount to drive trial)
- Big Day Box: 12 slices ($102) + cake "Honey" ($55) + chak-chak ($7) + truffles ($7.50) = $171.50 → $185 retail (premium positioning, branded packaging)
- Hotel Welcome Set: 8 slices ($68) + branded packaging cost ($10) = $78 → $95 retail (concierge-grade presentation)
- Subscription: $120 × 0.9 × 4 weeks = $432/mo recurring per subscriber

**Capacity headroom** (sized to fit inside the existing 420-minute kitchen budget):
- Sampler Box: ~10/day, limited by slice availability
- Big Day Box: 4/day, limited by the 12/day whole-cake cap
- Hotel Welcome Set: 8/day baseline
- Subscription: caps at roughly six active subscribers (each consumes one Office Box slot per week; 8 slots × 5 days ÷ 4 weeks ≈ 10 max with buffer for one-off catering)

**Revenue implication:** at six active subscribers × $432/mo, the subscription tier alone delivers $2,592/mo of recurring revenue — roughly half the $5,000 target before any new acquisition.

> **Implementation prerequisite:** the four new SKUs must be created in Square POS and surfaced on `/api/products` before the campaign goes live. Campaign creative leads with the Sampler and Office tiers as the entry CTA, with Big Day Box positioned for upsell.

---

## Recommended strategy — B2B Catering Offensive

The full $500/mo concentrates here. No split allocation across other channels.

### Budget allocation by month

| Sub-channel | M1 | M2 | M3 | M6 |
|---|---|---|---|---|
| Meta B2B Lead Gen — broad-net | $400 | — | — | — |
| Meta B2B Lead Gen — winners | — | $300 | — | — |
| Meta lookalikes | — | — | $250 | $200 |
| Meta retargeting (warm pool) | — | $100 | $150 | $200 |
| Google Local — catering intent | $100 | $100 | $100 | $100 |

### Ideal customer profiles (5 segments)

1. Office managers and executive assistants at 30–300 person offices in Sugar Land and the Energy Corridor (~85k matched profiles in Meta).
2. Boutique hotels and extended-stay properties — welcome amenity and in-room gifting use cases.
3. Independent coffee shops — wholesale slice supply.
4. Event planners and realtors — closing gifts and milestone events.
5. Medical and dental offices — patient appreciation and referral gifts.

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

> A 5:1 LTV:CAC ratio is the standard "excellent" benchmark across subscription and DTC categories. The projected 8.6:1 on year-1 alone clears that comfortably before any retention compounding is factored in.

### Attribution model

Standard local-food attribution mix. The simulator collapses everything to direct attribution; production performance distributes across the four channels below.

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

### Sensitivity

| Scenario | M1 first orders | Yr-1 rev/account cohort | Verdict |
|---|---|---|---|
| Top quartile (CTR 2%, CVR 12%, close 70%) | 12 | $17,200 | 3× over target |
| **Expected** | **5** | **$6,800** | **Clears target** |
| CTR halved | 2 | $2,640 | Misses |
| CPL doubled | 2 | $2,640 | Misses |
| Both halved | 0.6 | $725 | Catastrophic — kill |

**Break-even spend:** $235/mo on Meta B2B is the minimum monthly spend that returns the $5k year-1 target at the expected case — leaving $15 of headroom on the $400 Meta allocation.

---

## Alternative strategies

**B2C Anchor + Retargeting Flywheel ($500/mo)** — appropriate if catering demand proves saturated, or ahead of a major seasonal window (Mother's Day, Valentine's). CAC $17.86 against an industry baseline of $38–40, payback inside the first order, 4.7× LTV:CAC at year one, **6.3× cumulative ROAS by month six**. Pause if month-1 cold CAC exceeds $35.

**Local Awareness Walk-in** — included for completeness but not recommended in current conditions. Review `rev_003` flagged a 25-minute counter wait; surging walk-in volume amplifies that operational risk before it has been addressed.

**Custom Cakes Premium** — capacity-bound (4/day × 90 min per cake). Plateaus at ~2.5× ROAS regardless of spend efficiency. Not a fit for a $5k/mo target.

---

## Always-on organic track

Operates in parallel with the paid strategy. No advertising budget; requires roughly 8–12 hours per week of consistent content and on-page work. The asset compounds over time and lowers blended CAC every month it runs.

- **Local SEO:** 8 evergreen pages in m1–m2 (catering FAQ, delivery zones, allergen guide, birthday-cake size guide, hotel amenity menu, honey origin story, gluten-aware options, custom-cake pricing). Add `LocalBusiness`, `Bakery`, `Menu` schema.
- **Newsletter:** 3.5% site-capture + counter QR. Birthday-club ("free first slice on your birthday"). By m6: ~600 subs → 18% yr-1 conversion → ~$5,200/yr earned revenue at $0 spend.
- **GBP content:** weekly `gb_simulate_post`, reply every review (`gb_simulate_reply`) within 48h.

| M | Done |
|---|---|
| 1 | 8 pages drafted, schema validated, newsletter + QR live (~30h) |
| 3 | First long-tail rankings, list ~250 |
| 6 | Page-1 on 3–5 queries, list ~600, ~25 organic-attributed orders/mo |

---

## Supporting evidence from live MCP data

Four observed signals support the catering recommendation over alternatives:

1. **Unit economics asymmetry (LIVE).** Catering requires roughly 5 acquired accounts to clear the $5k year-1 target. Every other SKU requires between 35 and 95.
2. **Customer voice already validates the ICP (LIVE `gb_list_reviews`).** Review rev_004: *"We've been ordering from HappyCake for our office birthdays for months. Never disappointed."* The corporate-catering use case is already producing high-cadence repeat behavior organically.
3. **Local-search demand is measurable (LIVE `gb_get_metrics`, 30 days).** 87 direction requests and 41 calls — ~128 high-intent local actions per month — size the $100 Google Local sub-allocation against observed demand rather than estimate.
4. **Delivery capability is undermarketed (LIVE `gb_list_reviews`).** Review rev_002: *"Wish you delivered."* Delivery exists but customer awareness is low. All B2B creative leads with "free first delivery within 5 mi" to convert this latent demand.

---

## Risks that would invalidate the plan

| Risk | Signal | Response |
|---|---|---|
| B2B SQL rate below 15% | Month-1 leads converting poorly through the consultation funnel | Pivot to B2C Anchor strategy |
| Catering capacity becomes binding | `kitchen_get_production_summary` shows 8/8 daily slots filled | Cap budget; route overflow to next-week pickup |
| Front-of-house speed still slow | New 1–2★ reviews mentioning wait time | Hold Local Awareness; address operations first |
| Margin compresses below LIVE values | Office Box margin drops below 50% | Re-run year-1 economics with new inputs |
| Subscription tier underperforms | Fewer than 1 active subscriber by month 3 | Retire subscription; retain one-off catering |

---

## Confidence and limitations

Until the chosen strategy has spent $50 in market, every CTR / CPL / CVR figure carries an OUR EST. tag and is anchored on LIVE plus INDUSTRY inputs. The first $50 of spend should be treated as the data-acquisition phase, not the booking phase.

The sandbox simulator returns a flat ~4.20% CTR and ~$42 average order across all campaigns regardless of SKU or channel — useful as a "loop completes" check, not as a production forecast. Live performance will show variance, and the median row of the sensitivity table is a more realistic operating expectation than the simulator output. The plan's value is structural: the catering strategy clears the target at the expected case, and the alternatives are explicit when conditions change.

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

All LIVE figures refresh via `bun run marketing:brief`, which calls 14 sandbox tools in one pass.

---

## Operational flow

| Action | Surface |
|---|---|
| Owner reviews and selects a strategy | Telegram `/campaigns` → recommended strategy → **Approve & Launch** |
| Launch from CLI | `bun run marketing:run --strategy b2b-catering-offensive` |
| Refresh live MCP data | `bun run marketing:brief` (writes [MARKETING-BRIEF.md](MARKETING-BRIEF.md), gitignored) |
| Inspect live metrics | Telegram `/brief` (cached baseline) or `/campaigns` → strategy → **Read metrics** |
| Weekly loop closure | `marketing_get_campaign_metrics` → compare against expected-case row → `marketing_adjust_campaign` → `marketing_report_to_owner` |
| Single-strategy enforcement | Telegram blocks a second launch and explains the deployment rule |
