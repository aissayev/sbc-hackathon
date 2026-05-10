# Features — the matrix

Single tracker for "what exists / what's left." Pair with [03-build/CHECKLIST.md](../03-build/CHECKLIST.md) (submission gate) and [04-test/EVIDENCE.md](../04-test/EVIDENCE.md) (live scores).

Legend: ✅ done · ⏳ in progress · 🚫 cut · ⚠ at risk · 🔑 gated on credential, not code

Last refresh: submission-ready snapshot. Live evaluator pull: **380/400 (95%)** via `bun run evidence`.

---

## Channels (inbound + outbound)

| # | Feature | Status | DoD | Rubric line |
|---|---|---|---|---|
| C1 | `/api/chat` web endpoint | ✅ | POST {threadId, text} → `claude -p` → reply with thread persistence | F.T. · OSA |
| C2 | Web chat UI (Next.js, mounted on `/chat`) | ✅ | streaming text + tool cards, mobile-friendly, brand-themed | OSA |
| C3 | WhatsApp inbound webhook | ✅ | Meta GET-verify + POST-ack <5s, normalized to `IncomingMessage` | F.T. |
| C4 | WhatsApp outbound (`whatsapp_send` MCP + real Meta) | ✅ sandbox · 🔑 real | dual-path adapter via `WA_OUTBOUND_MODE`; real path lights up when `WA_TOKEN` + `WA_PHONE_NUMBER_ID` set | F.T. |
| C5 | Instagram inbound webhook (DM + comment) | ✅ | both event types normalize correctly | F.T. |
| C6 | Instagram outbound DM/comment | ✅ sandbox · 🔑 real | dual-path adapter via `IG_OUTBOUND_MODE` | F.T. |
| C7 | Telegram poller per bot (long-poll) | ✅ | one `getUpdates` poller per bot token, auto-started by `bun run dev` | OS |
| C8 | World scenario consumer | ✅ | `bun run world:run` processes `world_next_event` end-to-end through agent + tools | F.T. |

## Agents (`claude -p` subprocesses, Opus 4.7, headless)

| # | Role | Prompt | Tool allowlist | Brand-voice prepend | Status |
|---|---|---|---|---|---|
| A1 | concierge | ✅ | 12 tools (sandbox + local mix) | ✅ | ✅ live — escalation + draft creation tested |
| A2 | kitchen | ✅ | 10 tools | — exempt (operator-internal) | ✅ live — full lifecycle (create/accept/ready/reject) at 100/100 |
| A3 | marketing | ✅ | 14 tools | ✅ | ✅ live — `bun run marketing:run` lifts evaluator score to 100/100 |
| A4 | owner | ✅ | 10 tools | — exempt (operator-internal) | ✅ live — free-text turns w/ live streaming + auto-cards + event log |

## Telegram bots

| # | Bot | Functionality built | Token status | Status |
|---|---|---|---|---|
| B1 | Owner bot | ✅ slash (`/today`, `/orders`, `/escalations`, `/reset`, `/help`), inline-keyboard callbacks (approve/reject/view), free-text agent w/ live streaming, auto-cards on draft + escalation, event log | 🔑 user-supplied via BotFather | ✅ |
| B2 | Concierge bot (passive log) | ⏳ via owner event log instead — `📨` lines on inbound, `✓` on outbound | optional | ✅ via owner |
| B3 | Kitchen bot | ⏳ kitchen role reachable via owner free-text routing today; multi-bot fan-out is rubric-preferred not required | optional | rubric-preferred |
| B4 | Marketing bot | ⏳ marketing role reachable via `bun run agent:marketing`; multi-bot fan-out is rubric-preferred | optional | rubric-preferred |

## Brand voice

| # | Item | Status |
|---|---|---|
| BV1 | Canonical brand book ([docs/00-source/BRANDBOOK.md](../00-source/BRANDBOOK.md) v1.0) | ✅ |
| BV2 | Runtime-shaped subset ([src/agent/prompts/brand.md](../../src/agent/prompts/brand.md)) | ✅ |
| BV3 | Auto-prepend to customer-facing roles in `loadPrompt` ([src/agent/invoke.ts](../../src/agent/invoke.ts)) | ✅ |
| BV4 | Verified live: smoke produces `cake "Honey"` format, `HappyCake` wordmark, soft CTA close | ✅ |

## Website (Next.js, served from `web/` on :3001)

| # | Page | Status | DoD | Rubric line |
|---|---|---|---|---|
| W1 | `/` (home) | ✅ | brand styled, hero, CTA → `/menu` | A.F. |
| W2 | `/menu` | ✅ | catalog from MCP, JSON-LD per item | A.F. |
| W3 | `/menu/[slug]` | ✅ | per-product page, JSON-LD, "order now" → `/chat` | A.F. |
| W4 | `/chat` | ✅ | floating widget + page route | OSA |
| W5 | `/order/custom`, `/order/confirm` | ✅ | direct order flow + draft creation | F.T. · OSA |
| W6 | `/llms.txt` | ✅ | AI-crawler manifest | A.F. |
| W7 | `/api/products`, `/api/products/:id` | ✅ | public catalog JSON | A.F. |
| W8 | `robots.txt` allowlisting AI crawlers | ⏳ | Next.js generated; verify GPTBot/ClaudeBot/PerplexityBot allowlist | A.F. |
| W9 | `/openapi.json` | ✅ | hand-rolled spec via [src/web/openapi.ts](../../src/web/openapi.ts) | A.F. |
| W10 | `/admin/today`, `/admin/orders`, `/admin/escalations` | ✅ | owner web cockpit (TG is canonical; web is mirror) | OS |

## Marketing closed loop ($500 → $5,000)

| # | Step | Status | Verified by |
|---|---|---|---|
| M1 | Read sales history + margins | ✅ | hypothesis filled in `docs/01-product/HYPOTHESIS.md` |
| M2 | Draft 3 campaigns | ✅ | `marketing_create_campaign` × 3 in audit log |
| M3 | Owner approval flow | ✅ | TG inline keyboard → `marketing_launch_simulated_campaign` |
| M4 | Lead routing | ✅ | `marketing_generate_leads` × 9 → `marketing_route_lead` |
| M5 | Owner ROAS report | ✅ | `marketing_report_to_owner` posted |
| M6 | `evaluator_score_marketing_loop` | ✅ 100/100 | `bun run marketing:run` then `bun run evidence` |

## Kitchen handoff

| # | Step | Status | Verified by |
|---|---|---|---|
| K1 | Concierge creates draft order | ✅ | local MCP `create_draft_order` writes to SQLite + auto-posts owner card |
| K2 | Owner approves in TG | ✅ | inline button → `approveDraftAndPromote` → Square + Kitchen |
| K3 | Kitchen agent creates ticket | ✅ | `kitchen_create_ticket` w/ capacity check |
| K4 | Mark ready + notify customer | ✅ | `kitchen_mark_ready` → outbound on original channel |
| K5 | Reject path | ✅ | `kitchen_reject_ticket` w/ reason capture |
| K6 | `evaluator_score_pos_kitchen_flow` | ✅ 100/100 | `bun run boost` then `bun run evidence` |

## Evaluator + evidence

| # | Item | Status |
|---|---|---|
| E1 | `evaluator_get_evidence_summary` baseline | ✅ |
| E2 | `evaluator_score_marketing_loop` | ✅ 100/100 |
| E3 | `evaluator_score_pos_kitchen_flow` | ✅ 100/100 |
| E4 | `evaluator_score_channel_response` | ✅ 80/100 (🔑 real Meta to lift) |
| E5 | `evaluator_score_world_scenario` | ✅ 100/100 |
| E6 | Pre-submission snapshot in `docs/04-test/EVIDENCE.md` | ✅ |
| E7 | World scenario run captured to evidence | ✅ via `bun run world:run` + `bun run evidence` |

## Owner cockpit (rubric Operator Simulator)

| # | Item | Status |
|---|---|---|
| OC1 | 3-lane router (slash → callback → agent) | ✅ |
| OC2 | Slash commands DB-backed (free, instant) | ✅ |
| OC3 | Callbacks deterministic (no LLM in approve path) | ✅ |
| OC4 | Free-text agent with multi-turn thread context | ✅ |
| OC5 | Live streaming (`🤔` → `🛠 calling X` → final + tool footer) | ✅ |
| OC6 | Auto-cards from MCP (draft + escalation) | ✅ |
| OC7 | Event log (`📨 ✓ ⚠ 🔧`) with `TG_OWNER_LOG_LEVEL` dial | ✅ |

## Code Reviewer (10 pts) line-items

| # | Item | Status |
|---|---|---|
| R1 | Fresh-clone setup steps in README | ✅ |
| R2 | ARCHITECTURE.md with diagram | ✅ |
| R3 | `.env.example` with placeholders only | ✅ |
| R4 | No secrets in repo (`.mcp.json` gitignored, only `.template` committed) | ✅ |
| R5 | `bun run typecheck` clean | ✅ |
| R6 | `bun run smoke:agent` passes | ✅ |
| R7 | Per-role agent prompt files in `src/agent/prompts/` | ✅ |
| R8 | `bun run repro` 8/8 (fresh-clone reproducibility smoke) | ✅ |
| R9 | `bun run audit:hardcodes` 0 findings (-10 penalty insurance) | ✅ |

---

## Score-coverage estimate (live data)

| Rubric line | Max | Current | Path to max |
|---|---|---|---|
| Functional Tester | 20 | full | nothing pending; sandbox + real WA both wired |
| Agent-Friendliness | 15 | high | verify `robots.txt` allowlist (W8) |
| On-Site Assistant | 15 | full | brand voice + thread-aware web chat live |
| Code Reviewer | 10 | full | repro + audit + ARCHITECTURE + README |
| Operator Simulator | 15 | full | 7-line OC table all green |
| Business Analyst | 10 | full | hypothesis filled, loop scored 100 |
| Innovation | +10 | high | streaming UX, brand-prepend, audit gate, live evaluator pull |

**Live total:** `bun run evidence` → **380/400 (95%)**.

The 20-point gap is exclusively in `evaluator_score_channel_response` (80 → 100), which requires real Meta credentials in `.env.local` to flip outbound from sandbox-simulated to real. No code changes needed — `WA_OUTBOUND_MODE=both` already calls both backends in parallel; the real one will start landing once the token is set.
