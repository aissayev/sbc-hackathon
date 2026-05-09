# Features — the matrix

Single tracker for "what exists / what's left". Update this every hour. Pair with [03-build/STATUS.md](../03-build/STATUS.md) (timeline log).

Legend: ✅ done · ⏳ in progress · ❌ not started · ⚠ at risk

Last update: T+3h30m (2026-05-09 ~13:30 CT). Submission freeze: T+22h.

---

## Channels (inbound + outbound)

| # | Feature | Status | Owner | DoD | Rubric line |
|---|---|---|---|---|---|
| C1 | `/api/chat` web endpoint | ✅ | Adilet | POST {threadId, text} → claude -p → reply | F.T. · OSA |
| C2 | Web chat UI (assistant-ui island) | ❌ | Adilet | Mounted on `/chat`, streams text + tool cards, mobile | OSA |
| C3 | WhatsApp inbound webhook | ⏳ | Adilet | HMAC-verified, normalized, ack <5s | F.T. |
| C4 | WhatsApp outbound (`whatsapp_send` MCP) | ⏳ | Adilet | Reply lands in simulator thread | F.T. |
| C5 | Instagram inbound webhook | ❌ | Adilet | Same shape as WA | F.T. |
| C6 | Instagram outbound DM/comment | ❌ | Adilet | `instagram_send_dm` / `instagram_reply_to_comment` | F.T. |
| C7 | Telegram poller per bot | ⏳ | Owner-side | One `getUpdates` poller per bot token | OS |
| C8 | World scenario poller | ❌ | Adilet | 10s tick → `world_next_event` → router | F.T. |

## Agents (claude -p subprocesses)

| # | Role | Prompt | Allowlist | DoD | Status |
|---|---|---|---|---|---|
| A1 | concierge | ✅ | ✅ 9 tools | E2E: consultation / custom / complaint / status / escalation | ⏳ |
| A2 | kitchen | ✅ | ✅ 7 tools | Accept/reject ticket on capacity, mark ready | ❌ E2E |
| A3 | marketing | ✅ | ✅ 13 tools | Read CSV, draft × 3, owner approves, launch sim, report | ❌ |
| A4 | owner | ✅ | ✅ 9 tools | Daily report, approve/reject inline, evaluator preview | ❌ |

## Telegram bots

| # | Bot | Token | Implements | Status |
|---|---|---|---|---|
| B1 | @hc_owner_bot | ❌ from BotFather | `/today`, `/orders`, `/help`, approve_order, reject_order, daily digest | ❌ |
| B2 | @hc_concierge_bot | ❌ | passive log of customer threads | ❌ |
| B3 | @hc_kitchen_bot | ❌ | capacity warnings, ready pings | ❌ |
| B4 | @hc_marketing_bot | ❌ | ROAS digest, approve_campaign | ❌ |

## Website (`happycake.us` candidate)

| # | Page | Status | DoD | Rubric line |
|---|---|---|---|---|
| W1 | `/` (home) | ⏳ HTML scaffolded | Brand styled, hero, CTA → `/menu` | A.F. |
| W2 | `/menu` | ⏳ | Catalog from MCP, JSON-LD per item, brand styled | A.F. |
| W3 | `/menu/[slug]` | ❌ | Per-product page, JSON-LD, "order now" → `/chat` | A.F. |
| W4 | `/chat` | ❌ | assistant-ui island, mobile, brand themed | OSA |
| W5 | `/track/[code]` | ❌ | Status from SQLite + embedded chat | F.T. · OSA |
| W6 | `/llms.txt` | ✅ | AI-crawler manifest | A.F. |
| W7 | `/api/products`, `/api/products/:id` | ✅ | Public catalog JSON | A.F. |
| W8 | `robots.txt` allowlisting AI crawlers | ❌ | GPTBot, ClaudeBot, PerplexityBot, etc. allowed | A.F. |
| W9 | OpenAPI spec at `/openapi.json` | ❌ | Auto-generated from Hono routes | A.F. |

## Marketing closed loop ($500 → $5,000)

| # | Step | Status | DoD |
|---|---|---|---|
| M1 | Read sales history + margins | ❌ | HYPOTHESIS.md filled with real numbers |
| M2 | Draft 3 campaigns | ❌ | `marketing_create_campaign` × 3 |
| M3 | Owner approval flow | ❌ | TG inline → `marketing_launch_simulated_campaign` |
| M4 | Lead routing | ❌ | `marketing_generate_leads` → `marketing_route_lead` |
| M5 | Owner ROAS report | ❌ | `marketing_report_to_owner` at end-of-day |

## Kitchen handoff

| # | Step | Status | DoD |
|---|---|---|---|
| K1 | Concierge creates draft order | ⏳ | Local MCP `create_draft_order` writes to SQLite |
| K2 | Owner approves in TG | ❌ | Inline button → local MCP `approve_order` |
| K3 | Kitchen agent creates ticket | ❌ | `kitchen_create_ticket` w/ capacity check |
| K4 | Mark ready + notify customer | ❌ | `kitchen_mark_ready` → outbound on original channel |

## Evaluator + evidence

| # | Item | Status |
|---|---|---|
| E1 | `evaluator_get_evidence_summary` baseline | ❌ |
| E2 | `evaluator_score_marketing_loop` | ❌ |
| E3 | `evaluator_score_pos_kitchen_flow` | ❌ |
| E4 | `evaluator_score_channel_response` | ❌ |
| E5 | `evaluator_score_world_scenario` | ❌ |
| E6 | Demo script (`docs/04-test/EVIDENCE.md`) | ❌ |
| E7 | World scenario run captured to `evidence/` | ❌ |

## Code Reviewer (10 pts) line-items

| # | Item | Status |
|---|---|---|
| R1 | Fresh-clone setup steps | ✅ in README |
| R2 | ARCHITECTURE.md with diagram | ✅ |
| R3 | `.env.example` with placeholders only | ✅ |
| R4 | No secrets in repo | ✅ (`.mcp.json` gitignored, only `.template` committed) |
| R5 | `bun run typecheck` clean | ⏳ verify |
| R6 | `bun run smoke:agent` passes | ✅ |
| R7 | Per-role agent prompt files | ✅ in `src/agent/prompts/` |

---

## Score-coverage estimate (rough)

| Rubric | Max | Currently earning | Path to max |
|---|---|---|---|
| Functional Tester | 20 | ~6 | Wire C3–C8, K3, K4 |
| Agent-Friendliness | 15 | ~7 | W3, W8, W9 |
| On-Site Assistant | 15 | ~5 | C2, W4, W5 + scenario tests |
| Code Reviewer | 10 | ~9 | Final README pass |
| Operator Simulator | 15 | ~1 | B1–B4 with approval keyboards |
| Business Analyst | 10 | ~1 | M1–M5 |
| Innovation | +10 | ~0 | E1–E5 + brand-RAG + capacity recommender |
| **Total** | **95** | **~29** | **+66 to grab in 18h** |
