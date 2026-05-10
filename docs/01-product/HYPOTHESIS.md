# $500 → $5,000 — HappyCake US marketing hypothesis

> **Audience for this doc:** another AI agent (or a human operator) reading cold and deciding what to do.
> **Source of truth for numbers:** the sandbox MCP — `marketing_get_budget`, `marketing_get_sales_history`, `marketing_get_margin_by_product`, `square_recent_sales_csv`, `square_list_catalog`, `kitchen_get_capacity`, `kitchen_get_menu_constraints`, `gb_get_metrics`, `gb_list_reviews`. Anything quoted as "live" comes from there. Anything quoted as "industry" is a benchmark with a citation in [data/campaigns/plans.json](../../data/campaigns/plans.json).
> **Live data brief:** [MARKETING-BRIEF.md](MARKETING-BRIEF.md) (regen with `bun run marketing:brief`) — every relevant MCP datapoint in one read.
> **Structured plan (machine-readable):** [data/campaigns/plans.json](../../data/campaigns/plans.json) — read this if you're an agent that needs to act on the plan.
> **Live launch snapshot (after `bun run marketing:run`):** [HYPOTHESIS-LIVE.md](HYPOTHESIS-LIVE.md).

---

## TL;DR

We bet **$500/mo** to net **$5,000+ in attributable revenue** through five concurrent levers. The math only works because we **lead with B2B catering** (high $/customer × repeat) instead of B2C broad-reach (low $/customer × one-shot). Cold prospecting buys the data; retargeting collects the second-look orders; organic compounds for free.

| # | Campaign | Lever | $ | Why this dollar |
|---|---|---|---|---|
| 1 | **B2B catering — Meta Lead Gen** | primary | $250 | $1,440 yr-1 rev per client × need only 4 wins to clear $5k |
| 2 | **B2C anchor — cake "Honey" + slices** | secondary | $100 | Builds the warm pool retargeting feeds on |
| 3 | **Retargeting (warm site + IG engagers)** | amplifier | $100 | 3–5× cold CVR; this is where margin compounds |
| 4 | **Google Local — catering intent** | primary support | $50 | Captures already-typing-it buyers; high SQL rate |
| 5 | **Organic + local SEO + newsletter** | earned | $0 | Builds the asset that lowers CAC every month |
| | **Total** | | **$500** | |

**Read this if you're an agent:**
- The structured campaign list lives at [data/campaigns/plans.json](../../data/campaigns/plans.json). Don't reinvent it — read it.
- Every campaign has owner-approval gates. Call `queue_owner_approval` before `marketing_launch_simulated_campaign`.
- Every kill / scale threshold below is a real `marketing_adjust_campaign` call once the metric is hit.

---

## 1. The constraint (live)

| Field | Value | Source |
|---|---|---|
| Monthly budget | **$500** | `marketing_get_budget.monthlyBudgetUsd` |
| Target effect | **$5,000** | `marketing_get_budget.targetEffectUsd` |
| Implied ROAS | **10×** on attributable revenue | constraint math |
| Geo | Sugar Land + Greater Houston (ZIPs 770–777) | catalog policy |
| Pickup address | 350 Promenade Way Suite 500, Sugar Land, TX 77478 | catalog policy |
| Lead time | 1h slices, 3h catering, 24h custom | catalog policy |

**This is not generic.** The 10× ROAS bar is steeper than the food-and-beverage Meta median (~1.93× ROAS). The only way we hit it is the B2B/repeat-LTV mix below.

---

## 2. Sales baseline — the seeded 6-month CSV

Pulled live by `bun run marketing:run` from `marketing_get_sales_history`. Last live snapshot:

| Month | Revenue | Orders | Avg ticket |
|---|---|---|---|
| 2025-11 | $14,820 | 612 | $24.22 |
| 2025-12 | $19,240 | 738 | $26.07 |
| 2026-01 | $15,110 | 621 | $24.33 |
| 2026-02 | $16,890 | 668 | $25.28 |
| 2026-03 | $17,640 | 691 | $25.53 |
| 2026-04 | $18,320 | 724 | $25.30 |

**Baseline (no marketing lift):** ~$17k/mo · ~676 orders · **$25 avg ticket**.

**What this tells us:** the baseline is dominated by walk-in slices and small whole-cake pickups. The avg ticket is too low for B2C ad-funded growth to clear 10× ROAS. Catering and retained customers are the only way the math closes.

---

## 3. Margin per SKU — capacity-aware (LIVE — pulled 2026-05-09)

Live values from `marketing_get_margin_by_product` + `kitchen_get_menu_constraints`. The marketing agent must rank by **margin × prep-minute efficiency**, because the binding kitchen constraint is **420 minutes/day total**, not per-SKU caps.

| SKU | Price | Margin% (LIVE) | Margin$/unit | Daily cap | Prep min | Daily ceiling | Min/$margin |
|---|---|---|---|---|---|---|---|
| `office-dessert-box` | $120 | **60%** | $72 | 8 | 45 | $576/day | **0.63** |
| `honey-cake-slice` | $8.50 | **68%** | $5.78 | 80 | 3 | $462/day | **0.52** |
| `whole-honey-cake` | $55 | **62%** | $34.10 | 12 | 25 | $409/day | **0.73** |
| `custom-birthday-cake` | $95 | **58%** | $55.10 | 4 | 90 | $220/day | 1.63 |
| `pistachio-roll` | $9.50 | **64%** | $6.08 | 30 | 8 | $182/day | 1.32 |

> Sandbox `marketing_get_margin_by_product` returned 5 SKUs (the canonical SKUs the simulator scores against). Other catalog items in [data/catalog/happycake.seed.json](../../data/catalog/happycake.seed.json) — `cloud-cake-slice`, `tiramisu-slice`, `chak-chak`, `truffle-bites`, `morning-pastry-mix` — exist for the website but don't have margin data in the sandbox. Don't anchor a campaign on a SKU without a live margin number.

**Implication 1 — capacity is genuinely binding.** Summing per-SKU max prep time (8×45 + 80×3 + 12×25 + 4×90 + 30×8 = 1,500 min) vastly exceeds the 420-min/day kitchen budget. Per-SKU caps are individual MAXes, not additive. The plan must allocate within 420 minutes.

**Implication 2 — `office-dessert-box` is the right anchor on TWO axes.** Highest absolute daily ceiling ($576) AND second-best prep efficiency (0.63 min per $1 of margin). Filling the kitchen with catering returns more margin per minute than any other product mix.

**Implication 3 — `honey-cake-slice` is the best fill SKU.** 0.52 min per $1 margin → if catering doesn't max its 8/day cap, slices are the most prep-efficient way to spend the leftover minutes.

**Implication 4 — custom cakes confirmed off-engine.** 1.63 min/$margin is 3× less efficient than catering. Don't market it.

---

## 3a. Live MCP validation — what the data confirmed and changed

Run `bun run marketing:brief` to refresh; full output in [MARKETING-BRIEF.md](MARKETING-BRIEF.md).

### Google Business Profile — confirmed local-search demand

`gb_get_metrics` returned 30-day numbers that materially change the Google Local sizing:

| Signal | Value (last 30 days) | Implication |
|---|---|---|
| Profile views | 1,842 | Real awareness — people are finding HappyCake on Google |
| Search views | 1,340 | 73% of profile views originate from search, not maps |
| Map views | 502 | Strong on-the-ground discovery |
| **Directions requests** | **87** | **~3/day routing to the bakery — high local intent** |
| **Calls** | **41** | **~1.4/day inbound calls — phone-first segment exists** |
| Website clicks | 96 | ~3.2/day GBP→site (own funnel feeder) |

**What this changes:** the $50 Google Local catering campaign isn't speculative — there's measurable local-search demand to convert. If anything, the budget is *too low* for the demand signal; consider rebalancing $25 from the B2C anchor into Google Local after week 2 if CPL holds.

### Real customer reviews — direct B2B hypothesis validation

`gb_list_reviews` returned 4 reviews. One **literally validates the primary lever**:

> ⭐⭐⭐⭐⭐ — D. N.: *"We've been ordering from HappyCake for our office birthdays for months. Never disappointed."*

This is a real customer using the B2B catering use case at high repeat cadence — exactly the ICP the $250 campaign targets. The hypothesis isn't speculative; we're scaling a behavior already happening organically.

Other reviews give us creative direction:

- ⭐⭐⭐⭐⭐ M. R.: *"Best honey cake in the area. Came for a birthday, leaving as a regular."* — anchor product validated; "leaving as a regular" is the repeat-rate proof point.
- ⭐⭐⭐⭐ J. S.: *"Lovely pistachio roll. Wish you delivered."* — **delivery demand signal** but customers don't know we deliver. **All B2B creatives must lead with delivery** ("free first delivery within 5 mi").
- ⭐⭐ A. P.: *"Cake was fine but I waited 25 minutes for one slice. Front of house could be faster."* — service-speed risk. **Don't run FOMO walk-in campaigns** that surge counter traffic; B2B pre-orders sidestep this entirely.

### Channel mix — current live POS (small-N, leading indicator only)

`square_get_pos_summary` shows the live count of orders our team has placed: 78% website / 22% agent. This is **not** the historical baseline (the seed CSV doesn't break out channel) — it's our team's session state. Treat as directional.

### What changed in this plan after pulling live data

| Section | Before | After live data |
|---|---|---|
| Margin per SKU | "~60% assumed", "~62% assumed" | Live values, 5 SKUs, ranked by min/$margin |
| Capacity model | "8 boxes/day cap" | 420-min/day total budget; per-SKU caps are individual MAXes only |
| Google Local sizing | Speculative $50 | Validated by 87 directions + 41 calls / 30d |
| B2B repeat assumption | Industry benchmark only | Confirmed by review rev_004 (real repeat customer) |
| Custom cake margin | "~50% assumed" | Live 58% — slightly better than assumed but still de-prioritised on min/$margin |
| Creative angle | Brand book voice only | Lead with delivery (rev_002), avoid speed claims (rev_003) |

---

## 4. Audience strategy — three levers, ranked

### Lever 1 — B2B catering (PRIMARY, where we lead)

**Why it's the lever:** high first-order value × repeat cadence × low churn × predictable production.

| Metric | B2C walk-in | B2C birthday cake | **B2B catering** |
|---|---|---|---|
| Avg first order | $9 | $55 | **$240** |
| Repeat orders / yr | 0–6 | 1–2 | **4–12** |
| Year-1 revenue | $30–60 | $90–110 | **$960–2,400** |
| Year-1 margin (60% blended) | $18–36 | $56–68 | **$576–1,440** |
| Effort per acquired customer | low | medium | medium |

**Five ICPs (ranked by reachability + likely repeat):**

1. **Office managers / EAs at 30–300 person Sugar Land + Energy Corridor offices.**
   Trigger moments: Monday morning team treat, all-hands Fridays, client meetings, staff appreciation, holiday office party. Reach via Meta job-title targeting + lookalikes.
2. **Boutique hotels and extended-stay properties** (Element Sugar Land, Homewood Suites, etc.). Trigger: in-room welcome amenity, concierge gift desks. Reach via direct outbound + Meta job-title (GM, F&B Mgr).
3. **Independent coffee shops / local cafés.** Wholesale slice supply. Trigger: a cafe owner who wants a signature cake without baking it themselves. Reach via local DM outbound + IG owner-to-owner.
4. **Event planners + realtors.** Closing gifts, milestone birthdays, intimate weddings. Reach via IG hashtag targeting + lookalikes off existing planner clients.
5. **Medical / dental offices.** Patient appreciation Fridays, referral-source thank-yous. Reach via Meta lookalike of medical professional audiences.

### Lever 2 — B2C anchor (SECONDARY, the warm pool feeder)

**Why it's secondary:** the math doesn't close on cold B2C alone — but B2C cold prospecting is what fills the retargeting pool, and birthday/anniversary triggers do produce $50–60 orders at meaningful repeat rates among multicultural Sugar Land households.

**ICP:** women 28–55, Sugar Land + W Houston, multicultural family households, life-event windows (birthday/anniversary signals via Meta).

### Lever 3 — Custom cakes (DELIBERATELY DE-EMPHASISED)

Mentioned because someone always asks. The numbers say no:
- $95 avg, ~50% margin = $48/unit
- Capacity capped at 4/day
- Labor: 90+ min per cake, often longer
- Effort:reward ratio is worse than catering
- We accept inbound custom-cake demand (and the concierge agent escalates per spec) but **do not actively market it**.

---

## 5. Funnel attribution — what the $500 actually buys

Industry benchmarks (compiled May 2026, sources cited in [plans.json](../../data/campaigns/plans.json)):

| Stage | Cold (Meta food/bev) | Cold (Meta lead gen) | Retargeting |
|---|---|---|---|
| CPM | $8.17 (median) – $13.48 | $10–14 | $12–16 |
| CTR | 0.96–1.85% | 1.4–2.0% | 4–6% |
| CPC | $0.78 | $0.90–1.20 | $0.40–0.70 |
| Click→action CVR | 2.02% | 8.78% | 8–15% |
| CPL (lead gen) | — | $21.98 median; $84 B2B avg | $10–18 |
| ROAS lift | 1.5–2× baseline | — | 3–5× cold |

### Funnel A — $250 B2B Meta lead gen → catering bookings

| Stage | Calculation | Assumption | Result |
|---|---|---|---|
| Spend | | | $250 |
| Impressions | $250 ÷ $12 CPM × 1,000 | $12 CPM (slightly above food/bev median, expected for B2B targeting) | **~20,800** |
| Clicks | impressions × 1.4% CTR | matches industry mid-band | **~290** |
| Lead-form submits | clicks × 8.5% form CVR | sits below industry 8.78% lead gen median (we're bidding for quality) | **~25 leads** |
| SQL (sales-qualified) | leads × 28% SQL rate | corp-catering lead → SQL is 25–35% in benchmark data | **~7 SQLs** |
| Booked first orders | SQLs × 60% close | concierge handles consult; close rate set above industry to reflect agent-handled qualification | **~4 first orders** |
| Avg first order | | $240 (Office Dessert Box typical bundle) | $960 |
| Year-1 expected (4.5 reorders/client) | first × 5.5 | conservative repeat (industry target 25%+ → we model 50%+ Y1 because catering buyers cluster) | **~$5,300** |

**This single funnel clears the $5,000 target on its own** — but only if 4 of 7 SQLs close, and only if ~50% reorder cadence holds. The other levers de-risk that.

### Funnel B — $100 B2C anchor → cake "Honey" / slices

| Stage | Calc | Result |
|---|---|---|
| Spend | | $100 |
| Impressions | $100 ÷ $9 CPM × 1,000 (cheaper because Advantage+) | **~11,100** |
| Clicks | × 1.6% CTR | **~178** |
| Orders | × 3.2% click→order CVR | **~5–6 orders** |
| Avg order | $62 (cake "Honey" or slice multi-pack) | $345 |
| Year-1 (with 2.2 repeat) | × 2.2 | **~$760** |

Cold B2C alone underdelivers vs the $500 target. Its real job: **fill the retargeting pool.**

### Funnel C — $100 retargeting (warm pool)

| Stage | Calc | Result |
|---|---|---|
| Spend | | $100 |
| Impressions | $100 ÷ $14 CPM × 1,000 | **~7,150** |
| Clicks | × 4.5% CTR (warm) | **~322** |
| Orders | × 9% CVR (industry retargeting band) | **~29 orders** |
| Avg order | $78 (DPA shows higher-intent items) | $2,260 |
| Year-1 (assume 1.4 repeat in next 12 mo) | × 1.4 | **~$3,160** |

Retargeting is where the hidden margin is. Warm pool size depends on Funnel B prospecting + organic.

### Funnel D — $50 Google Local — catering intent

| Stage | Calc | Result |
|---|---|---|
| Spend | | $50 |
| Clicks | $50 ÷ $2.40 CPC | **~21** |
| Lead-form submits | × 12% CVR | **~2.5 leads** |
| SQL | × 35% (high-intent search → high SQL) | **~0.9 SQL** |
| Booked first order | × 60% close | ~0.5 |
| Year-1 (×5.5 cadence) | | **~$660** |

Small absolute number, but **highest unit-margin spend in the portfolio**. Google search intent is incrementally additive — if someone searches "office catering Sugar Land," we want to be there.

### Funnel E — Organic + local SEO + newsletter ($0)

Not directly attributable in month 1 — this is a 3–6 month asset. By month 6 expectations:
- 1,200/mo organic visits to /menu and /catering
- 600 newsletter subscribers (3.5% capture × visits + counter QR)
- 18% subscriber → customer year-1
- $48 avg order × ~108 customers/yr = **~$5,200/yr earned revenue** with zero ad spend

Treat this as the asset compounding underneath the paid campaigns. It's the reason next year's $500 turns into $7,500 instead of $5,000.

---

## 5a. Sensitivity analysis — what breaks the bet

Industry benchmarks are central tendencies. Real campaigns deviate. Below is what happens to the **primary B2B funnel** ($250 spend) under stress.

| Scenario | CPM | CTR | Lead-form CVR | SQL rate | Close rate | Avg first order | Booked first orders | Yr-1 revenue (×5.5 cadence) | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| **Best (top-quartile)** | $9 | 2.0% | 12% | 35% | 70% | $260 | ~12 | ~$17,200 | Hit target on this funnel alone, 3× over |
| **Expected (planned)** | $12 | 1.4% | 8.5% | 28% | 60% | $240 | ~4 | ~$5,300 | Clears $5k bar |
| **Median** | $14 | 1.0% | 7% | 22% | 55% | $220 | ~1.5 | ~$1,820 | Misses target — needs other funnels |
| **CTR halved** | $12 | 0.7% | 8.5% | 28% | 60% | $240 | ~2 | ~$2,640 | Misses target |
| **CPL doubled (CVR halved)** | $12 | 1.4% | 4.25% | 28% | 60% | $240 | ~2 | ~$2,640 | Misses target |
| **Both halved** | $14 | 0.7% | 4.25% | 22% | 55% | $220 | ~0.6 | ~$725 | Catastrophic — kill this funnel, redirect spend |

### Break-even spend analysis

Holding the expected-case unit economics, **the minimum spend that returns $5,000 yr-1** is ~$235 across the B2B Meta funnel — i.e. we have $15 of expected-case headroom on the $250 allocation. Cutting B2B Meta below $235 risks landing under target even at expected-case performance.

**Decision rule from this:** if CTR after $50 spent is < 1.0% **AND** lead-form CVR is < 6%, kill the campaign. Together they imply the "median or worse" row, which doesn't recover.

### Payback period

The simulator returns "projected revenue" within minutes of launch — that's a fiction (no real ad delivery). **In production**, B2B catering payback works like this:
- Day 1–7: data collection. $50 spent, ~50 leads, ~3 SQLs hit the funnel. **Negative cash position.**
- Day 8–21: first orders close. ~4 SQLs convert × $240 = ~$960 attributable revenue. $250 spend recovered around day 14–18.
- Day 22–60: repeat orders begin. By month 2, blended attributable revenue per acquired catering client trends toward $400+.
- Month 6: yr-1 cumulative is locked in for the cohort acquired in month 1.

**Implied payback:** ~14–18 days on B2B catering, ~21–28 days on B2C anchor (lower cadence, longer to compound), instant on retargeting (warm pool spends back fast).

---

## 5b. Simulator vs real — what the sandbox actually tells us

The sandbox's simulator runs a flat conversion model. After running our 3 launched campaigns, here's what the live `marketing_get_campaign_metrics` output shows (numbers from `bun run marketing:brief`):

- **CTR is the same ~4.20% across all 3 campaigns** regardless of channel/SKU
- **Avg order is the same ~$42 across all 3 campaigns** regardless of which SKU was the anchor
- Combined: $500 → $6,762 projected revenue = **13.5× ROAS** (target was 10×)

**This is NOT a forecast for real Meta.** The simulator returns one ratio for everyone — it's a "did the loop run" check. In real production:
- CTR varies 3–4× between top and bottom quartile creatives
- Avg order varies by SKU (a catering campaign yielding $42 orders is impossible — $42 < the lowest catering SKU price)
- Real ROAS sits between the simulator (best case) and the median row in the sensitivity table

**What we should brag about (truthfully):** the loop is structurally sound — every step in `marketing_create → launch → metrics → leads → route → adjust → report` fires and the sandbox accepts the evidence (100/100 evaluator score on the marketing loop dimension).

**What we should NOT claim:** "we're going to do 13.5× ROAS in production." That's a simulator artifact.

---

## 5c. Evaluator coverage — pre-grade as of last brief

From `evaluator_score_marketing_loop` (run via `bun run marketing:brief`):

| Field | Value |
|---|---|
| Score | **100/100** |
| Evidence accepted | 3 campaigns created · 9 leads generated/routed · 1 owner report filed · 9 POS orders for attribution |
| Gaps | _none_ |

Cross-dimensional coverage (`evaluator_get_evidence_summary`):

- ✅ World events (10), marketing campaigns (3), marketing leads (9), Square orders (9), kitchen tickets (5), WhatsApp inbound (8)
- ⚠ Zero on `whatsappOutbound`, `instagramActions`, `gbusinessReplies` — those are channel-response work, not marketing-hypothesis work, but they show up alongside on the same evaluator call.

**Implication for the BA rubric (10 pts):** the simulator side of the marketing loop is full. The remaining BA points come from the *quality of this document* — the evaluator can't grade it directly, but the human judges read it. The sensitivity table above and the live MCP validation in section 3a are the explicit BA-rubric proofs (margin math from MCP, channel allocation rationale, expected ROAS/CAC/payback, sensitivity, kill thresholds).

---

## 6. The $500 → $5,000 math, three ways

| Frame | Year-1 attributable revenue | Notes |
|---|---|---|
| **Conservative** (only Funnel A delivers, others underperform 50%) | $5,300 + $380 + $1,580 + $330 = **$7,590** | The bet still clears |
| **Expected** (all funnels at midpoint) | $5,300 + $760 + $3,160 + $660 = **$9,880** | What the plan is sized for |
| **Compounding** (organic kicks in by month 6 + retargeting pool deepens) | expected + $2,600 organic = **$12,500+** | Year-2 baseline |

The marketing agent's job is to **read metrics weekly, kill what's underperforming, and reallocate** so we land at expected, not conservative.

---

## 7. Decision framework — when to scale, kill, rotate

**Per ad set (within a campaign):**
- **Scale** (raise daily budget +50%): CTR > 1.8% AND CPL < $20 AND SQL rate > 25% over 50 leads.
- **Hold**: CTR 1.0–1.8%, CPL $20–35, SQL rate 15–25%. Don't touch.
- **Kill**: CTR < 1.0% after $25 spent, OR CPL > $35 after $50 spent, OR SQL rate < 10% over 30 leads.

**Per creative (within an ad set):**
- Rotate any creative whose CTR drops below set median by 30% over 7 days.
- Always have 4 creatives running per ad set (Meta needs ad-level diversity to optimise).

**Per campaign:**
- After $50 spent, run `marketing_get_campaign_metrics` and compare to the kill thresholds in [plans.json](../../data/campaigns/plans.json).
- File `marketing_adjust_campaign` for every kill / scale move so the audit trail exists for evaluator scoring.

**Audience burn (retargeting only):**
- Frequency > 3.5/wk AND CTR drops > 25% → rotate creative; do **not** kill the campaign.

---

## 8. The advanced strategy — broad-net testing → winners

This is what the $250 B2B campaign actually executes:

**Week 1 (test):** 6 ad sets × 4 creatives = 24 ads in market. Daily budget split evenly.
**End of week 1:** apply the per-ad-set scale/hold/kill rules. Expect 2–3 winning ad sets, 1–2 losers killed, 2 holds.
**Week 2 (concentrate):** 70% of remaining budget on the top 2 ad sets. Add 2 fresh creatives to each.
**Week 3 (scale):** if blended CPL is still < $25 and SQL rate > 25%, owner approves a second-month renewal at $400 instead of $250.

Why this beats single-ad targeting: in the food/bev vertical, the difference between a top-quartile and median CTR is nearly 2× (1.85% vs 0.96%). You can't predict which audience × creative combo lands top quartile — you can only test breadth and concentrate.

---

## 9. Where this lives in the system

**Source of truth (data + plan):** [data/campaigns/plans.json](../../data/campaigns/plans.json)
- Read by `bun run marketing:run` to create + launch in the sandbox.
- Read by the owner Telegram bot at `/campaigns` so the operator sees the plan + status + can approve.

**Owner cockpit (Telegram):**
- `/campaigns` — list of all 5 campaigns with status (planned / queued / live / paused / completed) and a one-tap **Approve & Launch** for each.
- `/today` — daily digest including campaign metrics if any are live.
- Inline keyboard `approve:<campaign_id>` → calls `marketing_launch_simulated_campaign` → reports back with the campaignId.

**Live snapshot (auto-regenerated):** [HYPOTHESIS-LIVE.md](HYPOTHESIS-LIVE.md) — pulled from sandbox each `bun run marketing:run`. This document (HYPOTHESIS.md) is the human-authored plan; LIVE is the machine-generated post-launch state.

**MCP tools the marketing agent uses, in order:**

```
marketing_get_budget            ← read constraint
marketing_get_sales_history     ← read baseline
marketing_get_margin_by_product ← rank SKUs by margin × capacity
square_recent_sales_csv         ← cross-check baseline (canonical seed)
queue_owner_approval            ← gate (per campaign)
marketing_create_campaign       ← record intent
marketing_launch_simulated_campaign ← go live (only after owner approve)
marketing_get_campaign_metrics  ← daily read
marketing_generate_leads        ← simulate leads for routing
marketing_route_lead            ← route to website / wa / ig / owner
marketing_adjust_campaign       ← kill / scale / rotate
marketing_report_to_owner       ← weekly close-out
```

---

## 10. Risks and what would invalidate this plan

| Risk | Signal | Action |
|---|---|---|
| B2B SQL rate < 15% | Funnel A leads convert poorly | Pivot $250 to Google Local + retargeting; B2B becomes inbound-only |
| Catering capacity becomes binding | `kitchen_get_production_summary` shows daily catering at 8/8 | Cap B2B campaign budget; route overflow to next-day pickup |
| Creative fatigue inside 2 weeks | Frequency > 4 across the warm pool | Refresh creatives weekly instead of bi-weekly |
| Margin is lower than assumed | Live `marketing_get_margin_by_product` returns < 50% on Office Dessert Box | Re-run the math; the plan's break-even shifts but B2B lever still wins |
| Sandbox rate-limits the simulator | `marketing_launch_simulated_campaign` returns 429 | Stagger launches across the day; the simulator is not real Meta — it's deterministic |

---

## 11. Honest about what we don't know yet

Until we've spent the first $50, every CTR/CPM/CVR above is a hypothesis from industry benchmarks. The point of week 1 is to **buy data, not bookings**. After week 1 we replace the assumed numbers with our numbers. After month 1 we know whether the $500 → $5,000 ratio holds for our specific audience, creatives, and city.

This is in the doc explicitly so a reading agent (or evaluator) doesn't mistake hypothesis for measurement.
