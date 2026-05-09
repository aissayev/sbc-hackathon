# Rubric — 100 pts + 10 bonus

Source: hackathon evaluation guide. Below is a literal mapping from rubric line to where in the codebase we earn it.

---

## Functional Tester — 20 pts

> "Simulated customer scenarios across WhatsApp, Instagram, website."

| Sub-line | Where we earn it | Status |
|---|---|---|
| Order on website | `src/channels/web.ts` + `/api/chat` + concierge agent + local MCP `create_draft_order` | ⏳ |
| Order via WhatsApp inbound | `src/channels/whatsapp.ts` + `whatsapp_inject_inbound` test | ⏳ |
| Order via Instagram DM | `src/channels/instagram.ts` + `instagram_inject_dm` test | ❌ |
| Comment-to-DM upgrade | `instagram_reply_to_comment` then `instagram_send_dm` | ❌ |
| World scenario events handled | `world_next_event` poller → router | ❌ |

## Agent-Friendliness Auditor — 15 pts

> "AI-agent usability; product comprehension without brittle scraping."

| Sub-line | Where | Status |
|---|---|---|
| `/llms.txt` manifest | `src/web/pages.ts` route | ✅ |
| JSON-LD per product page | `src/web/pages.ts` (W3) | ❌ |
| `robots.txt` allowing GPTBot/ClaudeBot/PerplexityBot | `src/web/pages.ts` route | ❌ |
| Stable URLs (`/menu/honey-cake-slice`) | `src/web/pages.ts` (W3) | ❌ |
| Public catalog JSON `/api/products` | live | ✅ |
| OpenAPI at `/openapi.json` | new | ❌ |
| Machine-readable policies (allergens, lead-time, capacity) | extend `/api/products/:id` | ⏳ |

## On-Site Assistant Evaluator — 15 pts

> "Product guidance, custom orders, complaints, status, escalation."

| Sub-line | Where | Status |
|---|---|---|
| Product guidance / consultation | concierge prompt + `square_list_catalog`, `kitchen_get_menu_constraints` | ⏳ |
| Custom cake intake | `local create_draft_order` → `escalate_to_owner` (custom = requires approval) | ❌ |
| Complaint handling | concierge prompt + `escalate_to_owner` w/ priority="urgent" | ❌ |
| Order status by code | `/track/<code>` page + concierge `get_order_status` | ❌ |
| Escalation path | `escalate_to_owner` → owner bot inbox | ❌ |
| Cites MCP evidence | every reply includes tool-call trace | ⏳ partial |
| Never invents | brand prompt enforces "ask MCP, never assume" | ⏳ |

## Code Reviewer — 10 pts

> "Architecture, MCP usage, README clarity, reproducibility, secrets hygiene."

| Sub-line | Where | Status |
|---|---|---|
| Fresh-clone runs | `README.md` "Quick start" | ✅ |
| ARCHITECTURE.md present | top-level | ✅ |
| `.env.example` with placeholders | `.env.example` | ✅ |
| `.mcp.json.template` committed, real `.mcp.json` gitignored | `.gitignore` | ✅ |
| No secrets in repo | grep clean | ✅ |
| Per-role decomposition visible | `src/agent/prompts/<role>.md` | ✅ |
| Two MCPs (sandbox + local) | `.mcp.json` | ✅ |
| Submit doc updates with the build | this file + STATUS log | ⏳ |

## Operator Simulator — 15 pts

> "Telegram bot operation by non-technical owner."

| Sub-line | Where | Status |
|---|---|---|
| Daily digest message | `src/bots/owner.ts` cron 8 PM | ❌ |
| Approve / reject inline keyboards | telegraf inline KB → local MCP | ❌ |
| `/today`, `/orders`, `/help` commands | `src/bots/owner.ts` | ❌ |
| Custom-order approval | inline → `approve_order` | ❌ |
| Marketing campaign approval | `src/bots/marketing.ts` | ❌ |
| Kitchen at-risk pings | `src/bots/kitchen.ts` | ❌ |
| ROAS alerts to owner | `src/bots/marketing.ts` | ❌ |
| One bot per agent (4 bots) | 4 telegraf instances | ❌ |

## Business Analyst — 10 pts

> "Marketing hypothesis validity against seeded sales data."

| Sub-line | Where | Status |
|---|---|---|
| Hypothesis derived from real sales CSV | `docs/01-product/HYPOTHESIS.md` | ⏳ skeleton |
| Margin math per SKU | from `marketing_get_margin_by_product` | ❌ |
| Channel allocation rationale | hypothesis | ❌ |
| Expected ROAS / CAC / payback | hypothesis | ❌ |
| One launched campaign | `marketing_launch_simulated_campaign` | ❌ |
| Adjustment after metrics | `marketing_adjust_campaign` | ❌ |

## Innovation Spotter — +10 bonus

| Sub-line | Where | Status |
|---|---|---|
| Evaluator self-score in CI | `evaluator_score_*` × 4 in `bun run evidence` | ❌ |
| Capacity-aware recommender | concierge picks SKU by `kitchen_get_capacity` | ❌ |
| Brand-RAG (ask the brandbook) | local MCP `brand_lookup` reading BRANDBOOK.md | ❌ |
| Multi-bot fan-out | 4 bots (already counted under OS) | — |
| Owner cockpit pulling evaluator scores | `/today` shows current rubric coverage | ❌ |
| Web tracking widget embed | `<iframe src="/track/<code>?embed=1">` | ❌ |

## Penalty avoidance

> "Hardcoded test answers = −10 pts + public note."

Every product, price, lead-time, capacity number is read from MCP at request time. No constants in `src/`. Verify before submission with `grep -r '8\.50\|5500\|420' src/` returning nothing.
