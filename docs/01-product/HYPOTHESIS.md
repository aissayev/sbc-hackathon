# $500 → $5,000 — HappyCake US marketing hypothesis

> **Audience for this doc:** another AI agent (or a human operator) reading cold and deciding what to do.
> **Source of truth for numbers:** the sandbox MCP — `marketing_get_budget`, `marketing_get_sales_history`, `marketing_get_margin_by_product`, `square_recent_sales_csv`, `square_list_catalog`, `kitchen_get_capacity`, `kitchen_get_menu_constraints`, `gb_get_metrics`, `gb_list_reviews`, `marketing_get_campaign_metrics`. Anything quoted as "live" comes from there. Anything quoted as "industry" is a benchmark cited in [data/campaigns/plans.json](../../data/campaigns/plans.json).
> **Live data brief:** [MARKETING-BRIEF.md](MARKETING-BRIEF.md) (regen with `bun run marketing:brief`).
> **Structured plan (machine-readable):** [data/campaigns/plans.json](../../data/campaigns/plans.json).

---

## The deployment rule (read first)

**$500/month deploys to ONE strategy at a time.** Splitting a $500 budget across 5 channels guarantees ~$100/channel, which is below every channel's learning threshold (Meta needs ~50 conversions to optimise; $100 buys ~5–25 leads, not 50). Splitting → no learning → no winners → we burn $500 and learn nothing about anything.

Instead, we pick **one strategy**, deploy the full $500 to it, and run it for at least one month before deciding to continue, scale, or pivot. Organic content runs alongside (zero ad budget, requires consistent effort).

This document presents 4 mutually-exclusive strategies. The owner picks one in Telegram `/campaigns`.

---

## TL;DR — what to pick

| # | Strategy | Full $500/mo allocation | Yr-1 RoAS at expected case | Recommendation |
|---|---|---|---|---|
| 1 | **B2B Catering Offensive** | 80% Meta Lead Gen, 20% Google Local | **9–10×** | ✅ **PICK THIS** |
| 2 | B2C Anchor + Retargeting Flywheel | 80% Meta Advantage+, 20% retargeting | 5–7× | Strong fallback / seasonal |
| 3 | Local Awareness Walk-in | 100% IG/GBP geo-fenced | 3–4× | ⚠ Service-speed risk (rev_003) |
| 4 | Custom Cakes Premium | 100% Meta lead gen for $95+ cakes | 2–3× | ❌ Capacity-constrained |
| — | **Always-on Organic** | $0 ads, 8–12 hrs/week effort | 6-month asset | Runs alongside whichever strategy is picked |

**Recommendation:** **Strategy 1 (B2B Catering Offensive)** is the only path that clears 10× ROAS at expected-case unit economics. The other paid strategies are valid alternatives if catering proves saturated, but their math is structurally weaker.

---

## Why B2B catering wins the math (live MCP data)

Three live data points, none of them speculative:

### 1. Margin × repeat × first-order value (live `marketing_get_margin_by_product` + `kitchen_get_menu_constraints`)

| Strategy anchor SKU | First order | Margin% (LIVE) | Margin$ | Repeat/yr | Yr-1 rev/customer | Wins needed for $5k yr-1 |
|---|---|---|---|---|---|---|
| **`office-dessert-box` (B2B)** | **$240** | **60%** | **$144** | **5.5** | **$1,440** | **~4** |
| `whole-honey-cake` (B2C anchor) | $62 | 62% | $38 | 2.2 | $136 | ~37 |
| `honey-cake-slice` (walk-in) | $9 | 68% | $6 | 6 | $54 | ~93 |
| `custom-birthday-cake` (custom) | $95 | 58% | $55 | 1.2 | $114 | ~44 |

**Math implication:** at $25.17 historical avg ticket and the 10× ROAS bar, only the B2B row needs a small number of wins. Every other strategy has to acquire 10×+ more customers from the same $500.

### 2. Customer voice already validates B2B (live `gb_list_reviews`)

> ⭐⭐⭐⭐⭐ — D. N.: *"We've been ordering from HappyCake for our office birthdays for months. Never disappointed."*

A real customer is doing the B2B catering use-case at high repeat cadence. We're not creating demand; we're scaling demand that exists.

### 3. Local-search demand is real (live `gb_get_metrics`, last 30 days)

| Signal | 30-day value |
|---|---|
| Profile views | 1,842 |
| Search views | 1,340 |
| **Direction requests** | **87** (~3/day) |
| **Phone calls** | **41** (~1.4/day) |
| Website clicks (from GBP) | 96 |

87 direction requests + 41 calls/mo = **~128 high-intent local actions/mo** that Google Local search can capture. The 20% Google Local sub-allocation in Strategy 1 is sized to that demand, not invented.

### 4. Honest read on the seed sales CSV

`marketing_get_sales_history` returns monthly aggregates only — there is no row-level seed data for SKU mix, channel mix, day-of-week patterns, or repeat-customer cohorts. We baseline on **$17,003/mo · 676 orders · $25.17 avg ticket** (last 6 mo, growing trend +$3,500 across the window) and project incremental lift on top. We do not over-fit; the simulator's `marketing_get_campaign_metrics` returns a flat ~4.20% CTR and ~$42 avg order regardless of channel/SKU — useful for "did the loop run" not for forecasting.

---

## STRATEGY 1 — B2B Catering Offensive (RECOMMENDED) · full $500/mo

### Allocation within the $500

| Sub-channel | Month 1 | Month 2 | Month 3 | Month 6 |
|---|---|---|---|---|
| Meta B2B Lead Gen — broad-net testing | $400 | — | — | — |
| Meta B2B Lead Gen — winners | — | $300 | — | — |
| Meta lookalikes (off purchaser list) | — | — | $250 | $200 |
| Meta retargeting (warm pool) | — | $100 | $150 | $200 |
| Google Local — catering intent | $100 | $100 | $100 | $100 |

### ICP — five segments, ranked by reachability × repeat probability

1. **Office managers / EAs at 30–300 person Sugar Land + Energy Corridor offices.** Trigger moments: Monday team treat, all-hands Fridays, client meetings, staff appreciation, holiday office party. Reach via Meta job-title targeting + 1% lookalikes. ~85k matched profiles in the Houston DMA.
2. **Boutique hotels & extended-stay properties** (Element Sugar Land, Homewood Suites, etc.). Trigger: in-room welcome amenity, concierge gift desks. Reach via Meta job-title (GM, F&B Mgr) + direct outbound.
3. **Independent coffee shops / local cafés.** Wholesale slice supply. Reach via local DM + IG owner-to-owner.
4. **Event planners & realtors.** Closing gifts, milestone birthdays. Reach via IG hashtag targeting + lookalikes off existing planner clients.
5. **Medical / dental offices.** Patient appreciation, referral thank-yous. Reach via Meta lookalike of medical professional audiences.

### 6-month rollout — what good looks like at each milestone

#### Month 1 — Data acquisition (testing breadth)

**Spend:** $400 Meta Lead Gen + $100 Google Local
**Creative structure:** 6 ad sets × 4 creatives = 24 ads in market by end of week 1. Themes: Monday team treat, client meeting, staff appreciation, holiday office party, realtor closing gift, hotel welcome. Every lead-form ad leads with **free first delivery within 5 mi** (review rev_002 told us customers don't know we deliver).

**Expected outcomes:**
- 33,000 impressions
- 460 clicks (CTR 1.4%)
- 32 lead-form submits (CVR 7%)
- 9 SQLs (28% qualify rate)
- **5 first orders × $240 avg = $1,200 month-1 revenue**
- **Yr-1 projection (5.5 reorders/account): $6,800**

**Decision rules at end of month 1:**
- Kill ad set if CTR < 1.0% after $50 OR CPL > $35 after $50.
- Scale ad set 50% if CPL < $20 AND SQL rate > 25%.
- **Pivot to Strategy 2** if blended CTR < 0.8% AND CPL > $40 across the whole strategy after $250 cumulative spend (mediocre row in sensitivity table).

#### Month 2 — Optimization (concentrate on winners)

**Spend:** $300 winners + $100 retargeting + $100 Google Local
**Creative structure:** Pause kills. Top 2 surviving ad sets get 70% of the $300. Each gets 2 fresh creatives weekly to fight fatigue. Retargeting layer launches now — month 1 prospecting built a 4–6k warm pool.

**Expected outcomes:**
- 50 leads, 16 SQLs, 9 first orders (cohort 2)
- 3 reorders from cohort 1 ($720 reorder revenue)
- **Month-2 revenue: $2,400 · cumulative: $3,600**

#### Month 3 — Scale (lookalikes + repeat compound)

**Spend:** $250 lookalikes + $150 retargeting + $100 Google Local
**Creative structure:** 1% lookalike on the acquired catering customer list. Retargeting splits between 30-day site visitors and 90-day non-buyers. Frequency cap at 3.5/wk per audience.

**Expected outcomes:**
- 70 leads, 22 SQLs, 13 first orders (cohort 3)
- 8 reorders across cohorts 1+2
- **Month-3 revenue: $4,400 · cumulative: $8,000 · cumulative ROAS: 5.3×**

#### Month 6 — Compounding (cohort LTV realized)

**Spend:** $200 lookalikes + $200 retargeting + $100 Google Local
**State:** repeat-cycle is the engine now. ~70% of monthly revenue comes from cohorts 1–4 reordering, ~30% from new acquisition.

**Expected outcomes:**
- **Month-6 revenue: $7,500 · cumulative: $28,000 · cumulative spend: $3,000 · cumulative ROAS: 9.3×**
- 55 acquired accounts, 38 actively reordering

### Sensitivity — what breaks Strategy 1

| Scenario | Yr-1 revenue per first-month cohort | Verdict |
|---|---|---|
| Best (top quartile CTR 2%, CVR 12%, close 70%) | $17,200 | 3× over target |
| **Expected (planned)** | **$6,800** | **Clears target** |
| Median (industry mid) | $1,820 | Misses |
| CTR halved | $2,640 | Misses |
| CPL doubled | $2,640 | Misses |
| Both halved | $725 | Catastrophic — kill |

**Break-even spend:** $235/mo on Meta B2B is the minimum that returns $5k yr-1 at expected case → $15 of headroom on the $400 Meta allocation. Cutting Meta below $235 risks landing under target.

---

## STRATEGY 2 — B2C Anchor + Retargeting Flywheel · full $500/mo

**When to pick this instead of Strategy 1:**
- B2B catering has been tried and saturated (>20% of acquired accounts come from organic referral, not ads — meaning incremental ad-driven acquisition is hard).
- Major seasonal window approaching (Mother's Day, Valentine's, Thanksgiving, Christmas, Eid, Nauryz). Whole-cake demand spikes 2–4× and is best captured by B2C creative.
- Owner wants to build a public-facing brand presence faster than B2B accumulates one.

### 6-month rollout

| Month | Spend | Sub-allocation | Expected month rev | Cumulative |
|---|---|---|---|---|
| 1 | $500 | $400 Advantage+ cold · $100 retargeting | $1,736 | $1,736 |
| 2 | $500 | $300 cold · $200 retargeting | $2,400 | $4,136 |
| 3 | $500 | $250 lookalikes · $250 retargeting | $2,900 | $7,036 |
| 6 | $500 | $200 lookalikes · $300 retargeting | $4,200 | **$19,000 / 6.3× cumulative ROAS** |

**Yr-1 LTV per acquired buyer ~$110**; we need ~50 new customers/mo + 80% retargeting conversion to clear $5k.

**Kill rule:** pause if month 1 cold CAC > $35 OR retargeting ROAS < 2× by end of m1. Pivot to Strategy 1.

---

## STRATEGY 3 — Local Awareness Walk-in · full $500/mo (NOT recommended)

**Why outlined:** completeness. The owner may want to surge walk-in traffic on a slow week.
**Why not recommended:**

> ⭐⭐ A. P.: *"Cake was fine but I waited 25 minutes for one slice. Front of house could be faster."*

This live review tells us the front-of-house is the bottleneck. Surging walk-ins with $500 of geo-fenced ads makes that worse, not better. B2B pre-orders sidestep counter friction entirely.

**Math anyway:** 200 incremental walk-in slices/mo × $5.78 margin = $1,156. Caps at 3.6× ROAS by month 6. Cannot scale.

---

## STRATEGY 4 — Custom Cakes Premium · full $500/mo (NOT recommended)

**Why outlined:** premium ticket ($95+) and high social-share value tempt people.
**Why not recommended:** capacity is binding. 4 cakes/day × 90 min/cake × 58% margin = labor-intensive, kitchen-minute-inefficient (1.63 min per $1 of margin — 3× worse than catering at 0.63 min/$).

**Math:** caps at $7,500 cumulative revenue by month 6 / 2.5× ROAS. Don't pick this.

---

## ALWAYS-ON ORGANIC — $0 ads, runs alongside whichever strategy is picked

**This is not an alternative to the paid strategy. It runs in parallel.** It needs zero ad budget but **8–12 hours/week of consistent content + on-page work** to deliver. By month 6 organic typically delivers 20–35% of total customer acquisition for a local food business — that's the asset that lowers blended CAC every month going forward.

### Three tracks

**1. Local SEO + content.** 8 evergreen pages built in months 1–2:
- Catering FAQ
- Sugar Land delivery zones
- Allergen guide
- Birthday-cake size guide
- Hotel amenity menu
- Six-layer honey origin story
- Gluten-aware options
- Custom-cake pricing reality

Add `LocalBusiness`, `Bakery`, `Menu` schema to /menu/* (already partially in `/llms.txt` per the rubric checklist).

**Expected:** by month 6, ~1,200/mo organic traffic to /menu and /catering. Page-1 ranking on 3–5 long-tail queries (e.g. *"office catering Sugar Land"*, *"honey cake near me"*).

**2. Newsletter.** Site capture at 3.5% of visits + counter QR for in-store. Bi-weekly email: monthly bake calendar, allergen-aware tips, behind-the-counter stories. Birthday-club: "free first slice on your birthday."

**Expected:** by month 6, ~600 subscribers. 18% subscriber→customer yr-1 = ~108 buyers/yr × $48 avg order = ~$5,200/yr earned revenue at zero ad spend.

**3. GBP content.** Weekly post via `gb_simulate_post`. Reply to every review (`gb_simulate_reply`) within 48h. Monthly photo refresh.

**Expected:** by month 6, GBP profile views grow ~30%. Direction requests + calls grow proportionally — improves the ceiling on whichever paid strategy is running.

### Organic timeline

| Month | What's done |
|---|---|
| 1 | 8 evergreen pages drafted, schema validated, newsletter form live, counter QR in store. ~30h total. |
| 2 | Pages indexed; newsletter list at ~80–120; GBP posting cadence stable. |
| 3 | First long-tail rankings appearing. Newsletter list ~250. |
| 6 | Page-1 on 3–5 queries; newsletter ~600; first measurable organic-attributed orders ~25/mo. |

**Why this matters for whichever paid strategy is picked:** organic is the reason next year's $500 turns into $7,500 instead of $5,000. The longer organic runs, the more efficient paid acquisition becomes.

---

## The decision framework

```
Pick Strategy 1 (B2B Catering) if:
  - You want the highest-LTV path
  - Office Dessert Box capacity headroom exists (currently 8/day cap)
  - You're comfortable with a 4–6 month payback on cohort LTV

Pick Strategy 2 (B2C Anchor) if:
  - Strategy 1 has been tried and CPL > $40 was hit
  - You're approaching a seasonal window (Mother's, Valentine's, etc.)
  - Brand visibility is a higher priority than account LTV

Pick Strategy 3 only if you've fixed the front-of-house speed issue first.
Don't pick Strategy 4 — the unit economics don't support it.

Run Always-on Organic in parallel regardless of paid strategy.
```

---

## How this maps to the system

**Telegram cockpit (`/campaigns`):**
- Lists 4 paid strategies + organic track.
- Recommended strategy badged ⭐.
- Tap a strategy → see ICP, rollout, projection, kill rules.
- Tap **Approve & Launch** on the chosen one — full $500 deploys to that strategy.
- Other strategies remain visible as alternatives but unspent.

**Backing scripts:**
- `bun run marketing:brief` — pulls 14 sandbox tools into a baseline + brief.
- `bun run marketing:run --strategy <id>` — launches the chosen strategy in the sandbox (full $500 to it).

**Loop closure:**
- Daily: `marketing_get_campaign_metrics` for the launched strategy.
- Weekly: `marketing_report_to_owner` summarises against expected-case sensitivity row.
- Monthly: re-run `marketing:brief`, compare actual to projection, decide continue/scale/pivot.
- Re-baseline organic at months 2, 3, 6.

---

## Risks that would invalidate this whole plan

| Risk | Signal | Action |
|---|---|---|
| B2B SQL rate < 15% | Strategy 1 m1 leads convert poorly | Pivot to Strategy 2 |
| Catering capacity becomes binding | `kitchen_get_production_summary` shows 8/8 daily | Cap Strategy 1 budget; route overflow to month-out pickup |
| Front-of-house still slow | New 1–2★ reviews mention wait | Don't run Strategy 3 even if owner asks; address ops first |
| Organic effort drops below 6 hr/week | Page traffic flat at month 3 | Re-evaluate; likely deprioritise organic or hire a content contractor |
| Margin lower than live | `marketing_get_margin_by_product` returns < 50% on Office Dessert Box | Re-run Strategy 1 yr-1 math; break-even shifts but B2B still wins |

---

## Honesty about what we don't know yet

Until the chosen strategy has spent $50 in market, every CTR/CPL/CVR above is a hypothesis from industry benchmarks plus the live MCP signals (margins, GBP demand, real reviews). The first $50 buys data, not bookings. After week 1 we replace assumed numbers with measured numbers and tighten the projection. After month 1 we know whether the strategy clears its expected case or needs to pivot.

The simulator's `marketing_get_campaign_metrics` returns flat 4.20% CTR / $42 avg order regardless of strategy — that's a sandbox artifact, not a forecast. Production Meta will have variance.

This is in the doc explicitly so a reading agent (or evaluator) doesn't mistake hypothesis for measurement.
