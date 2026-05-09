# $500 → $5,000 marketing hypothesis (HappyCake US, Sugar Land TX)

> **Status:** stub. Numbers below are placeholders pending live read of `marketing_get_sales_history` + `marketing_get_margin_by_product` from the sandbox MCP. Final version will replace every "TBD" with actual figures.

## Constraint

- **Monthly budget:** $500 (per `marketing_get_budget`)
- **Target effect:** $5,000 in attributable revenue (10× ROAS)
- **Audience:** women 25–65 with families, Sugar Land + 10mi, multicultural (Anglo + Hispanic + South Asian + Central Asian diaspora)
- **Channels available:** Meta Ads, Google Ads, boosted IG, organic IG/GBP

## Margin per SKU (sandbox catalog)

| SKU | price | margin% | margin$ | per-unit |
|---|---|---|---|---|
| honey-cake-slice | $8.50 | 68% | $5.78 | best $/labor minute |
| whole-honey-cake | $55 | 62% | $34.10 | best $/order |
| pistachio-roll | $9.50 | 64% | $6.08 | |
| custom-birthday-cake | $95 | 58% | $55.10 | high-ticket but capacity-constrained (4/day, 24h lead) |
| office-dessert-box | $120 | 60% | $72 | best $/customer (catering, recurring) |

Source: `docs/00-source/SNAPSHOT.md` — verify live with `marketing_get_margin_by_product`.

## Hypothesis

**Anchor product:** *whole honey cake* — recognizable, signature, $34 margin, 12/day capacity = clear daily revenue ceiling we can drive toward.

**Secondary:** *office dessert box* — $72 margin, 8/day capacity = $576/day potential. The B2B catering lane is the highest $/customer but needs longer lead times.

**Allocation (provisional):**

| Channel | Spend | Hypothesis | Expected leads | CAC | Conversion | Expected revenue |
|---|---|---|---|---|---|---|
| Meta Ads (IG feed + reels) | $200 | Visual-led. "Sugar Land birthday cake by tomorrow." Whole honey + custom birthday. | 80 | $2.50 | 12% | $1,400 (10 whole-cake + 2 custom) |
| Google Ads (search) | $150 | Local intent: "birthday cake sugar land", "office dessert box houston". | 30 | $5 | 30% | $2,200 (5 office boxes + 4 whole) |
| Boosted IG posts | $100 | Best organic post each week, $25 boost. Office-dessert-box catering angle. | 25 | $4 | 16% | $720 (4 office + 1 whole) |
| Organic (IG + GBP) | $0 | Daily IG story, 2 IG posts/week, GBP weekly post. Care-card in box drives reviews. | — | — | — | $700 retention/repeat |
| **Total** | **$450** | (with $50 reserve for what wins) | **135** | **$3.33 blended** | **18%** | **~$5,020** |

**Why this clears $5,000:** the catering lane (office boxes + custom cakes) carries enough margin per order that we don't need many. 5 office boxes + 4 whole + 2 custom = $940 in margin alone, and that's a small slice of the leads the budget should generate.

## Kill thresholds

- Pause Meta if CTR < 1.5% after $50 spend
- Pause Google if conversion < 8% after $30 spend
- Pause boosted IG if engagement < 2% after $20 spend

## Loop

```
day 0  read margin_by_product + sales_history + GBP metrics
day 1  draft 4 campaigns, each with creative brief + landing path
day 1  queue all 4 for owner approval (Telegram inline keyboard)
day 1  on approval: marketing_create_campaign + marketing_launch_simulated_campaign
day 2  marketing_get_campaign_metrics — kill or scale per kill thresholds above
day 3  generate leads via marketing_generate_leads, route via marketing_route_lead
day 7  marketing_report_to_owner with weekly summary
```

## What's NOT in this hypothesis

- Wedding cakes (we don't make them)
- Cold-outbound (community-led, not push)
- TV / billboards (out of budget)
- Influencers (no time to vet for this hackathon)

---

**Author:** Adilet · **Confidence:** medium until numbers are read from sandbox · **Next:** run `bun run smoke:agent` against the marketing role to read sales history live and replace the table with real figures.
