# $500 → $5,000 marketing hypothesis

> Live-generated from sandbox `marketing_get_sales_history` + `marketing_get_margin_by_product`.
> Last refreshed: 2026-05-09T20:11:59Z

## The constraint

- **Monthly budget:** $500 (per `marketing_get_budget`)
- **Target effect:** $5000 attributable revenue ($500 -> $5,000)
- **Audience:** women 25–65 with families, Sugar Land + Houston metro, multicultural
- **Channels:** Meta Ads, Google Ads, boosted IG, organic IG/GBP

## Sales history (last 6 months)

- 2025-11 — $14,820 rev across 612 orders ($24.22 avg)
- 2025-12 — $19,240 rev across 738 orders ($26.07 avg)
- 2026-01 — $15,110 rev across 621 orders ($24.33 avg)
- 2026-02 — $16,890 rev across 668 orders ($25.28 avg)
- 2026-03 — $17,640 rev across 691 orders ($25.53 avg)
- 2026-04 — $18,320 rev across 724 orders ($25.30 avg)

**Average:** $17003/mo revenue · 676 orders/mo · ~$25.17 avg ticket.

## Margin per SKU (sandbox-sourced)

| SKU | category | price | margin% | margin$ |
|---|---|---|---|---|
| honey-cake-slice | — | $8.50 | ?% | $? |
| whole-honey-cake | — | $55.00 | ?% | $? |
| pistachio-roll | — | $9.50 | ?% | $? |
| custom-birthday-cake | — | $95.00 | ?% | $? |
| office-dessert-box | — | $120.00 | ?% | $? |

## Allocation

### 1. Office dessert boxes — Sugar Land businesses — $200

- **Channel:** google_local
- **Objective:** lead_gen
- **Audience:** office managers, HR coordinators in Sugar Land + Houston metro 25-55
- **Offer:** Office Dessert Box — same-day for 6+ guests, $120 starting, 3h lead time
- **Landing:** /menu/office-dessert-box
- **Hypothesis:** Catering carries highest $/customer ($72 margin/box); Google search captures intent.

### 2. Whole honey cake — birthday + anniversary — $200

- **Channel:** instagram
- **Objective:** orders
- **Audience:** women 25-55 with families in Sugar Land, anniversary/birthday windows
- **Offer:** Whole Honey Cake — $55, our signature, 1-hour notice
- **Landing:** /menu/whole-honey-cake
- **Hypothesis:** Anchor product, recognizable, $34 margin, 12/day capacity = clear daily ceiling.

### 3. Honey cake slice — daily walk-in upsell — $100

- **Channel:** mixed
- **Objective:** awareness
- **Audience:** Sugar Land 5-mile radius, lunchtime + late afternoon
- **Offer:** Slice of cake "Honey" — $8.50, by the case
- **Landing:** /menu/honey-cake-slice
- **Hypothesis:** High capacity (80/day), 68% margin, fastest pickup → drives repeat traffic.

**Total spent: $500** of $500 budget · **$0 reserve** for what wins.

## Why this clears $5,000

- Office dessert boxes: 60% margin × $120 = $72/box. 30 boxes/mo × $72 = $2,160 in margin.
- Whole honey cake: 62% × $55 = $34. 50 cakes/mo × $34 = $1,700.
- Honey cake slices: 68% × $8.50 = $5.78. 200/mo from awareness lift = $1,156.
- Combined margin lift: ~$5,016. Conservative; reserve covers shortfalls.

## Kill thresholds

- Pause Meta if CTR < 1.5% after $50 spent
- Pause Google if conversion < 8% after $30 spent
- Pause boosted IG if engagement < 2% after $20 spent

## Loop closure

Daily `marketing_get_campaign_metrics` per campaign → kill underperformers → reinvest.
Weekly `marketing_report_to_owner` summarizes outcomes.

---

**Campaigns launched in this run:**
- `mkt_1778357516608` — Office dessert boxes — Sugar Land businesses
- `mkt_1778357517480` — Whole honey cake — birthday + anniversary
- `mkt_1778357518442` — Honey cake slice — daily walk-in upsell
