# $500 → $5,000 — HappyCake US marketing hypothesis

A marketing plan for a $500/month ad budget targeting $5,000/month in attributable revenue. Designed to be reviewed by the owner from Telegram and executed by the agent system without further translation.

Companion files: [plans.json](../../data/campaigns/plans.json) (machine-readable plan) · [MARKETING-BRIEF.md](MARKETING-BRIEF.md) (live MCP data brief, refreshed by `bun run marketing:brief`).

---

## Thesis

**HappyCake's catering math wins the $5K/mo target on its own.**

The Office Dessert Box returns **$72 of margin** in 45 kitchen minutes — the most efficient SKU in the live catalog (LIVE: `marketing_get_margin_by_product`). Acquiring **5 office accounts in month one** at a $100 CAC pays back inside the first order ($144 first-order margin > $100 CAC, no cash drawdown past week one). Industry-standard B2B catering reorder cadence (~5×/year, INDUSTRY: PeopleLinx) carries the plan from $1,200/mo at launch to **$7,500/mo by month six** — a 9.3× cumulative ROAS, without any contribution from a subscription tier or B2C campaign.

The full $500/mo concentrates on **B2B Catering Offensive** — Meta lead-gen + Google Local. Splitting across five channels yields ~$100 each, below every channel's learning threshold. Single-strategy concentration is the deployment rule.

## How it compounds

Paid spend buys **acquisition once**. Three levers carry the rest:

| Lever | What | Why it compounds |
|---|---|---|
| **1. Reorders** | Acquired catering accounts reorder ~5×/year | By m6, retained accounts produce more revenue than new acquisition — the engine is self-sustaining |
| **2. Lookalikes** | From m3, Meta runs 1% lookalike-of-purchasers | Each acquired account sharpens future targeting; CPA falls month over month |
| **3. Organic** | GBP posts, schema.org pages, newsletter capture (~10 hr/wk, $0 spend) | By m6 contributes ~25 orders/mo at zero CAC, dragging blended CAC down |

The 6-month trajectory at the expected case:

| Month | Spend | Mo. revenue | Cum. ROAS | Engine state |
|---|---|---|---|---|
| M1 | $500 | $1,200 | 2.4× | Test breadth — 5 first orders |
| M2 | $500 | $2,400 | 3.6× | Concentrate winners — retargeting layer launches |
| M3 | $500 | $4,400 | 5.3× | Lookalikes scale — 13 first + 8 reorders |
| M6 | $500 | **$7,500** | **9.3×** | Reorders dominate — 38 active accounts |

By month four the reorder line crosses the new-acquisition line. That's the inflection. Past it, every additional account compounds existing volume, and the kitchen ceiling (8 Office Boxes/day) starts to matter more than ad spend. The plan is sized so that even at the *expected* row of the [sensitivity table](#sensitivity) — not best-case — the target closes; catastrophic outcomes are visible at $250 of cumulative spend, not $3,000.

## Strategy options

| Strategy | $/mo | Yr-1 cumulative ROAS | Pick? |
|---|---|---|---|
| **B2B Catering Offensive** | $500 | **9.3× by m6** | ✅ Recommended |
| B2C Anchor + Retargeting | $500 | 6.3× by m6 | Fallback / seasonal |
| Local Awareness Walk-in | $500 | 3.6× plateau | ⚠ FOH-speed risk |
| Custom Cakes Premium | $500 | 2.5× plateau | ❌ Capacity-bound |
| Always-on Organic | $0 + 10 hr/wk | n/a | ✅ Always (parallel to paid) |

**Pivot rule.** If month-1 CTR < 1.0% AND CPL > $40 across the strategy after $250 cumulative spend, pause and pivot to B2C Anchor.

---

## How to read every figure

Every number in this document carries one of four provenance tags so the source of any claim can be checked at a glance:

| Tag | Meaning | Example |
|---|---|---|
| **LIVE** | Pulled from the sandbox MCP at the last brief refresh — see [Data sources](#data-sources). | LIVE: 60% margin |
| **INDUSTRY** | Public benchmark (May 2026). Citations in [plans.json](../../data/campaigns/plans.json) → `industryBenchmarks`. | INDUSTRY: 1.4% CTR |
| **OUR EST.** | A modeled estimate built on LIVE and INDUSTRY inputs. Confirmed only after the first $50 of real spend. | OUR EST.: 5 first orders |
| **OUR PROPOSAL** | A new SKU or program proposed for the campaign and not yet in the live catalog. | OUR PROPOSAL: Sampler Box $48 |

Subscription positioning: the Weekly Corporate Subscription tier is a **Phase-2 lever** that activates only after Phase 1 (months 1–3) demonstrates catering acquisition is working. The $5,000/mo target is hit by month six on Phase 1 alone — see [Target math: with vs. without subscription](#target-math-with-vs-without-subscription).

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

A single $120 entry point is a high commitment for a first-time B2B buyer. The recommendation is to introduce a tiered offer ladder — three new SKUs composed from existing inventory — to broaden the funnel and capture both trial-stage and premium demand. None currently exist in the live catalog. A fourth proposal — Weekly Corporate Subscription — is **deferred to month four** as an expansion bet and is documented separately under [Subscription program (deferred)](#subscription-program); the headline $5K math does not depend on it.

| SKU | Tier | Retail | Composition | Margin% | Margin$ | Role |
|---|---|---|---|---|---|---|
| **Sampler Box** | Entry | **$48** | 3× honey slice + 2× pistachio + 1× tiramisu | 60% | $29 | Trial — 4-person team taste test |
| Office Dessert Box (existing) | Core | $120 | (no change) | 60% | $72 | Workhorse — 8–10 person team |
| **Big Day Box** | Premium | **$185** | 12 slices + 1 cake "Honey" + chak-chak + truffles | 58% | $107 | Upsell — 18+ ppl, holidays, realtor closings |
| **Hotel Welcome Set** | ICP-specific | **$95** | 8 slices in branded packaging | 55% | $52 | Hotel concierge / in-room amenity |

### Pricing build-up

- **Sampler Box.** Six retail slices would be $51 (3 × $8.50 + 2 × $9.50 + 1 × $8.50). Bundled retail is $48 — a $3 trial discount. Margin holds at 60% because the per-unit slice cost (~$3.40 raw materials + labor) is unchanged; the discount comes out of the markup. This is the trial-friction lever.
- **Big Day Box.** $51 (slices) + $51 (more slices) + $55 (whole cake) + $7 (chak-chak) + $7.50 (truffles) = $171.50 → $185 retail (premium positioning, branded packaging).
- **Hotel Welcome Set.** 8 × $8.50 = $68 cost-equivalent + $10 packaging cost = $78 → $95 retail (concierge-grade presentation).
- **Subscription (deferred).** $120 × 0.9 × 4 weeks = $432/mo recurring per subscriber (10% volume discount). See [Subscription program](#subscription-program) for activation gate.

### Capacity and cannibalization

Sized to fit inside the 420-minute kitchen envelope and not displace existing slice demand:

- **Sampler Box.** ~10/day, limited by slice availability. At 10 boxes that's 60 slices — 75% of the 80/day slice cap. Recommend capping Sampler Box production at 6/day during ramp so walk-in slice demand is preserved.
- **Big Day Box.** 4/day, limited by the 12/day whole-cake cap.
- **Hotel Welcome Set.** 8/day baseline.
- **Subscription (if and when activated in m4).** Caps at six active subscribers (each consumes one Office Box slot/week; 8 slots × 5 days ÷ 4 weeks ≈ 10 max with buffer for one-off catering).

> **Implementation prerequisite.** The four new SKUs must be created in Square POS and surfaced on `/api/products` before the campaign goes live. Campaign creative leads with the Sampler and Office tiers as the entry CTA, with Big Day Box positioned for upsell.

---

## Subscription program {#subscription-program}

The Weekly Corporate Subscription is a **deferred month-4+ expansion bet**. It activates in month four only after Phase 1 demonstrates catering acquisition is working, and the headline $5K/mo target does not depend on it.

### Mechanics

- **Sign-up.** Website form (`/subscribe`) or Telegram-approved owner email. Capacity check at signup: each new subscriber consumes one Office Box slot/week permanently.
- **Billing.** Monthly recurring via Square Subscriptions. $432/mo charged on a fixed date each month.
- **Delivery cadence.** One Office Box per week, day of customer's choosing.
- **Lock-in.** None. Month-to-month. Cancel anytime with seven days' written notice.
- **Pause.** Up to four free pause weeks per year for customer holiday closures.
- **Trial offer.** First month at 50% off ($216) to lower commitment friction. Full $432 cycle from month two.
- **Tier flexibility.** Subscribers may swap weekly delivery between Sampler / Office / Big Day Box without re-signing. Box value differential billed at next cycle.
- **Churn baseline.** 8% monthly churn modeled (industry corporate-subscription baseline 5–8%).

### Activation gate

Do not enable the subscription tier until **all** conditions hold at end of month three:

- 25+ acquired catering accounts active across Phase 1
- Office Box capacity utilization < 50% (room for recurring slots)
- Square Subscriptions configured and recurring billing tested
- Owner approves activation in Telegram

### Upside if activated

By month six: 6 active subscribers × $432/mo = **$2,592/mo of recurring revenue**, incremental on top of the $7,500/mo Phase 1 catering rollout. Activation moves the run-rate from $7,500 → ~$10,000/mo without additional ad spend.

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

### Funnel derivation — how "5 first orders" is computed

The keystone estimate of five first orders in month one is built from explicit stage factors. Each stage carries its own provenance tag and source:

| Stage | Calculation | Result | Source |
|---|---|---|---|
| Spend on Meta B2B Lead Gen | (allocation) | $400 | budget |
| CPM | $12 (food/bev top-of-band, B2B premium) | — | INDUSTRY (WordStream Q2 2026) |
| Impressions | $400 / $12 × 1,000 | **33,000** | computed |
| CTR | 1.4% | 462 clicks | INDUSTRY (AdAmigo lead-gen median 1.0–2.0%) |
| Lead-form completion rate | 8% (form fill, accounting for 25% form abandonment) | **37 leads** | INDUSTRY (Meta lead-gen median 8.78%) |
| SQL rate (concierge agent qualification) | 25% (catering inquiries that fit ICP + serviceable area) | 9 SQLs | OUR EST. against INDUSTRY corp catering 25–35% range |
| Close rate (consult to first order) | 55% | **5 first orders** | OUR EST., conservative |

The chain — 33,000 impressions → 462 clicks → 37 leads → 9 SQLs → **5 first orders** — is the keystone of the plan. The sensitivity analysis below stress-tests each link.

### CAC / LTV / payback math

| Metric | Value | Source |
|---|---|---|
| Month-1 ad spend | $500 | budget |
| Acquired accounts (m1) | 5 | OUR EST. (funnel above) |
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

### Attribution model and conservative scenario

The split below is OUR EST. for a local food brand running Meta + GBP + branded organic. It is not a sourced industry benchmark — there is no canonical "cake-industry attribution mix." Each channel will be measured directly so the model self-corrects after month one:

| Channel | Share | How measured |
|---|---|---|
| Direct click-through | 30% | UTM `utm_source=meta&utm_medium=paid&utm_campaign=catering-q2` |
| View-through | 40% | Meta pixel; order if user saw a campaign ad in the last 7 days |
| Branded search | 20% | Order referrer is "happycake sugar land" or direct-URL within 7 days of an ad impression |
| Phone call | 10% | `gb_get_metrics.callsClicks` correlated with ad-active days; promo code "TASTE" on phone orders |

**Conservative scenario** — if view-through and branded search drop out (50% of attributed revenue assumed unattributable):

| Metric | Full attribution | Conservative (direct + phone only) |
|---|---|---|
| First orders M1 | 5 | 3 |
| Year-1 cohort revenue | $6,800 | $4,200 |
| Year-1 cumulative ROAS | 9.3× | ~5.6× |

Even under conservative attribution the strategy clears 5× ROAS by month six.

### Competitive landscape

No live MCP data is available for competitor signals — this section is INDUSTRY plus OUR EST.

**Likely Sugar Land + Energy Corridor catering competitors:**
- National corporate catering: ezCater, Foodee
- Bakery / restaurant chains with catering: Le Madeleine, Panera, Whole Foods catering
- Office snack delivery: SnackNation, Caroo (recurring office boxes)
- Local independent bakeries

**Implication for CAC.** B2B catering carries switching costs — many target offices already have a vendor and a recurring habit. The campaign is less about creating demand and more about **displacing or supplementing** existing relationships. Free first delivery and the $48 Sampler Box are positioned as low-friction trial mechanisms specifically designed to bypass switching cost.

**Risk if a competitor enters the same Meta audience during the campaign:** CPM rises in the auction. Organic + retained-customer compounding gives independence from short-term auction pressure (see [Risks](#risks)).

### 6-month rollout

| Phase | Spend | Target outcomes |
|---|---|---|
| **M1 — Test breadth** | $500 | 6 ad sets × 4 creatives = 24 ads. 33k imps · 460 clicks · 32 leads · 9 SQLs · **5 first orders / $1,200 rev** |
| **M2 — Concentrate winners** | $500 | Pause kills, top 2 sets get 70%. Retargeting layer launches. 50 leads, 9 first + 3 reorders. **$2,400 mo / $3,600 cum** |
| **M3 — Scale lookalikes** | $500 | 1% lookalike off purchaser list. 13 first + 8 reorders. **$4,400 mo / $8,000 cum / 5.3× cum ROAS** |
| **M4 — Subscription gate** | $500 | If activation gate passes, soft-launch subscription tier. Catering acquisition continues. |
| **M6 — Compounding** | $500 | Repeat-cycle is the engine. **$7,500 mo / $28,000 cum / 9.3× cum ROAS / 55 acquired / 38 active** |

### Week-by-week activity calendar (Month 1)

| Week | Marketing | Owner action | Concierge agent |
|---|---|---|---|
| W0 (pre-launch) | 4 new SKUs created in Square + `/api/products`. Meta ad account, Lead Forms, retargeting pixel set up. | Approve SKUs and creative briefs in Telegram. | — |
| W1 | 24 ads (6 sets × 4 creatives) live. ~$100 spend. | Daily glance at `/campaigns` metrics. | Reply to lead-form replies within a 1-hour SLA. |
| W2 | Mid-test review. Apply per-ad-set kill rules. ~$100 more. | Approve any kill recommendations. | Qualify new leads against ICP. |
| W3 | Concentrate budget on survivors. ~$150 spend. | — | First catering consultations. |
| W4 | ~$150 spend. End-of-month review against expected case. | Decide month-2 continuation. | Close first orders. |

### Cash flow timeline

The plan is cash-negative for roughly the first week, breaks even mid-month-1, and is materially cash-positive from month two forward.

| Stage | Cumulative spend | Cumulative revenue | Cumulative margin | Net cash position |
|---|---|---|---|---|
| Mid W1 | $100 | $0 | $0 | **−$100** |
| End W2 | $200 | $480 | $288 | **+$88** |
| End M1 | $500 | $1,200 | $720 | **+$220** |
| End M2 | $1,000 | $3,600 | $2,160 | **+$1,160** |
| End M3 | $1,500 | $8,000 | $4,800 | **+$3,300** |
| End M6 | $3,000 | $28,000 | $16,800 | **+$13,800** |

**Maximum cash drawdown:** approximately $250 in week one. The owner needs to absorb $250 of pre-revenue spend; from week two forward the strategy is cash-positive on margin.

### Decision tree

| Time | Condition | Action |
|---|---|---|
| End W2 | Any ad set CTR < 1.0% **OR** CPL > $35 | Kill that ad set (auto, no owner approval needed) |
| End W4 | Blended CTR < 0.8% **AND** CPL > $40 | Pause whole strategy, brief owner, recommend pivot to B2C Anchor |
| End M1 | 0 first orders | Kill outright; do not enter m2 |
| End M1 | 1–2 first orders | Continue m2 with tightened audience |
| End M1 | 3+ first orders | Continue m2 unchanged |
| End M1 | 5+ first orders | Ahead of plan; flag m3 budget bump option |
| End M3 | Blended ROAS > 4× | Recommend owner approve $750/mo budget for m4 |
| End M3 | 25+ active accounts AND owner approves Square Subscriptions setup | Soft-launch Subscription tier (Phase 2) |
| Anytime | New 1–2★ review on FOH speed | Hold Local Awareness recommendation; do not launch even if owner asks |

"Blended CTR" means impression-weighted across all six ad sets, not the simple mean. Same for blended CPL.

### Kill / scale rules

- **Kill ad set:** CTR < 1.0% after $50 spent OR CPL > $35 after $50 spent
- **Scale ad set:** CPL < $20 AND SQL rate > 25% over 50 leads → +50% daily budget
- **Pivot strategy:** if blended CTR < 0.8% AND CPL > $40 after $250 cumulative spend → switch to B2C Anchor

### Sensitivity {#sensitivity}

| Scenario | M1 first orders | Yr-1 rev/account cohort | Verdict |
|---|---|---|---|
| Top quartile (CTR 2%, CVR 12%, close 70%) | 12 | $17,200 | 3× over target |
| **Expected** | **5** | **$6,800** | **Clears target** |
| CTR halved | 2 | $2,640 | Misses |
| CPL doubled | 2 | $2,640 | Misses |
| Both halved | 0.6 | $725 | Catastrophic — kill |

**Break-even spend:** $235/mo on Meta B2B is the minimum monthly spend that returns the $5k year-1 target at the expected case — leaving $15 of headroom on the $400 Meta allocation.

---

## Target math: with vs. without subscription {#target-math-with-vs-without-subscription}

The $5,000/mo target is reached by Phase 1 catering acquisition alone. Subscription is upside.

| Path | Phase 1 (catering only) | + Phase 2 (subscription added m4) |
|---|---|---|
| M3 monthly revenue | $4,400 | $4,400 (sub not yet active) |
| M6 monthly revenue | **$7,500** (clears target) | **~$10,100** (target +100%) |
| M6 cumulative revenue | $28,000 | ~$33,000 |
| M6 cumulative ROAS | 9.3× | ~11× |

If the Subscription tier underperforms or never activates, the plan still hits target. If it works, the plan over-delivers. The structural risk of the subscription proposal is bounded.

---

## Alternative strategies

**B2C Anchor + Retargeting Flywheel ($500/mo)** — appropriate if catering demand proves saturated, or ahead of a major seasonal window (Mother's Day, Valentine's). CAC $17.86 against an industry baseline of $38–40, payback inside the first order, 4.7× LTV:CAC at year one, **6.3× cumulative ROAS by month six**. Pause if month-1 cold CAC exceeds $35.

**Local Awareness Walk-in** — included for completeness but not recommended in current conditions. Review `rev_003` flagged a 25-minute counter wait; surging walk-in volume amplifies that operational risk before it has been addressed.

**Custom Cakes Premium** — capacity-bound (4/day × 90 min per cake). Plateaus at ~2.5× ROAS regardless of spend efficiency. Not a fit for a $5k/mo target.

---

## Always-on organic track

Operates in parallel with the paid strategy. No ad budget; requires roughly 8–12 hours per week of consistent content and on-page work. The asset compounds over time and lowers blended CAC every month it runs.

- **Local SEO.** 8 evergreen pages in m1–m2 (catering FAQ, delivery zones, allergen guide, birthday-cake size guide, hotel amenity menu, honey origin story, gluten-aware options, custom-cake pricing). Add `LocalBusiness`, `Bakery`, `Menu` schema.
- **Newsletter.** Capture forms on /menu and /catering, plus a counter QR code. Birthday-club ("free first slice on your birthday") drives high-engagement signups.
- **GBP content.** Weekly post via `gb_simulate_post`. Reply to every review (`gb_simulate_reply`) within 48 hours.

### Newsletter math, examined

| Stage | Value | Source |
|---|---|---|
| Site capture rate | 5% of visits (revised up from 3.5% with birthday-club incentive) | INDUSTRY (high-intent food-vertical lists 4–8%) |
| Counter QR capture | ~30 signups/mo at 200 walk-ins/mo and 15% scan rate | OUR EST. |
| Site visits required for 600 subs by m6 | ~9,000 cumulative visits (~1,500/mo by m6) | computed |
| Newsletter → first-purchase yr-1 conv | 18% (birthday-anchored, opt-in food list) | INDUSTRY (general retail 8–15%; high-engagement food/lifestyle 15–25%) |
| Yr-1 earned revenue at m6 list size | ~108 buyers × $48 avg order = **~$5,200/yr** | computed |

**Traffic feasibility check.** 1,500 organic visits/mo by month six is the load-bearing assumption. Achievable for a Sugar Land bakery with eight evergreen pages, GBP optimization, and active review replies — but ambitious for organic-only. If site traffic plateaus below 800/mo by month three, the newsletter target compresses to ~350 subs and ~$3,000/yr earned revenue. Still a free upside layer; not a critical path.

### Organic timeline

| M | Done |
|---|---|
| 1 | 8 evergreen pages drafted, schema validated, newsletter form + QR live (~30 hours of work) |
| 3 | First long-tail rankings indexed; list ~250 |
| 6 | Page-1 on 3–5 queries; list ~600; ~25 organic-attributed orders/mo |

---

## Supporting evidence from live MCP data

Four observed signals support the catering recommendation over alternatives:

1. **Unit economics asymmetry (LIVE).** Catering requires roughly 5 acquired accounts to clear the $5k year-1 target. Every other SKU requires between 35 and 95.
2. **Customer voice already validates the ICP (LIVE `gb_list_reviews`).** Review rev_004: *"We've been ordering from HappyCake for our office birthdays for months. Never disappointed."* The corporate-catering use case is already producing high-cadence repeat behavior organically.
3. **Local-search demand is measurable (LIVE `gb_get_metrics`, 30 days).** 87 direction requests and 41 calls — ~128 high-intent local actions per month — size the $100 Google Local sub-allocation against observed demand rather than estimate.
4. **Delivery capability is undermarketed (LIVE `gb_list_reviews`).** Review rev_002: *"Wish you delivered."* Delivery exists but customer awareness is low. All B2B creative leads with "free first delivery within 5 mi" to convert this latent demand.

---

## Risks {#risks}

| Risk | Signal | Response |
|---|---|---|
| B2B SQL rate below 15% | Month-1 leads converting poorly through the consultation funnel | Pivot to B2C Anchor strategy |
| Catering capacity becomes binding | `kitchen_get_production_summary` shows 8/8 daily slots filled | Cap budget; route overflow to next-week pickup |
| Front-of-house speed still slow | New 1–2★ reviews mentioning wait time | Hold Local Awareness; address operations first |
| Margin compresses below LIVE values | Office Box margin drops below 50% | Re-run year-1 economics with new inputs |
| Subscription underperforms | Fewer than 1 active subscriber by m6 | Retire subscription tier; Phase 1 still clears target |
| **Form abandonment higher than 25%** | Lead-form fill rate < 6% on Meta | Reduce form fields; A/B simpler mobile-first form |
| **Delivery-zone mismatch** | Significant lead volume from outside ZIPs 770–777 | Tighten Meta geo-fence; auto-decline out-of-zone leads in concierge agent |
| **Seasonality drag** | Aug–Dec is the corporate-catering peak; Jan–Feb is the trough | Plan launches in May (shoulder); model 30% trough-month dip in m9–m10 if running long |
| **Competitor entry into Meta audience** | CPM rises >40% in 14 days | Shift toward Google Local; lean on retained-customer revenue compounding |
| **Cash-flow squeeze** | Owner cannot absorb the $250 max drawdown in week one | Reduce m1 spend to $300; extend test period to six weeks |

### What can move the numbers

Until the chosen strategy spends $50 in market, every CTR / CPL / CVR figure carries an OUR EST. tag and rests on LIVE plus INDUSTRY inputs. The first $50 should be treated as data acquisition, not booking activity.

The sandbox simulator returns flat ~4.20% CTR and ~$42 average order across all campaigns regardless of SKU or channel — useful as a "loop completes" check, not a production forecast. Live performance will show variance, and the *Expected* row of the [sensitivity table](#sensitivity) is a more realistic operating expectation than the simulator output.

The plan's value is structural: the catering strategy clears the target at the expected case, the alternatives are explicit when conditions change, and the kill criteria limit downside to $250 of pre-pivot spend.

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

### Agent disambiguation (for downstream automation)

- **"Blended CTR" / "blended CPL"** are impression-weighted across all six ad sets, not simple means.
- **If proposed SKUs are not yet in Square at launch time:** block the launch with a clear error referencing the [Implementation prerequisite](#proposed-new-skus-our-proposal). Do not silently proceed without them; the campaign creative depends on them.
- **Auto-adjust scope:** ad-set-level kill on threshold breach is automatic. Strategy-level pivot (switching from Catering to B2C Anchor) requires owner approval through Telegram.
- **Subscription activation gate:** the agent reads three conditions (25+ active accounts, capacity < 50%, owner-approved billing setup) and blocks subscription tier creation until all three pass.

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
| Newsletter conversion (18%) | INDUSTRY: high-engagement food/lifestyle list 15–25%, modeled at 18% with birthday-club anchoring |
| Subscription churn (8%) | INDUSTRY: B2B subscription baseline 5–8% |
| Competitive landscape | INDUSTRY + OUR EST. (no MCP signal available) |
| Attribution split (30/40/20/10) | OUR EST. for local-food brand mix; measured via UTM, pixel, referrer, promo code |
| New SKU prices (Sampler / Big Day / Hotel / Subscription) | OUR PROPOSAL — built up from LIVE existing-SKU prices, see [plans.json](../../data/campaigns/plans.json) `suggestedNewSkus` |

All LIVE figures refresh via `bun run marketing:brief`, which calls 14 sandbox tools in one pass.
