# Submission checklist

Pulled from the hackathon brief §8 and the team kit. Tick when shipped; link to evidence.

**Live evidence:** `bun run evidence` → 380/400 (95%) · `bun run repro` → 8/8 · `bun run audit:hardcodes` → 0 findings

---

## Repo hygiene

- [x] Public Git repository — `https://github.com/aissayev/sbc-hackathon`
- [x] Final commit before May 10, 10:00 CT
- [x] `.env.example` with placeholders only — `.env.example`
- [x] `.mcp.json.template` committed; `.mcp.json` gitignored
- [x] No secrets in repo (`git grep -nE 'sbc_team_[a-f0-9]{32}|sk-ant-' returns empty`)
- [x] README "Quick start" runs from a fresh clone — verified by `bun run repro` (8/8)

## Architecture & docs

- [x] `ARCHITECTURE.md` at root with component diagram
- [x] `AGENTS.md` mirroring CLAUDE.md / agent operating notes
- [x] `docs/INDEX.md` entry point
- [x] `docs/01-product/HYPOTHESIS.md` filled with real numbers from `marketing_get_sales_history`
- [x] `docs/04-test/RUNNABLE-SCENARIOS.md` — 25 scripted scenarios with commands + pass criteria
- [x] `docs/04-test/SCENARIOS.md` — 8 customer scenarios + this matrix
- [x] `docs/04-test/EVIDENCE.md` — pre-submission snapshot with current 380/400 scores
- [x] `docs/01-product/SCENARIOS-MATRIX.md` — 90 scenarios across LEADS/CONSUMERS/PARTNERS
- [x] `docs/03-build/OWNER-BOT-SETUP.md` — three-lane router + streaming + log-level guide

## Runtime

- [x] Agent runs on `claude -p` Opus 4.7 only (no SDK, no other LLM)
- [x] Owner UI is Telegram-only
- [x] Both MCPs configured (sandbox HTTP + local stdio)
- [x] `bun run smoke:agent "..."` passes
- [x] `bun run typecheck` clean
- [x] `bun run dev` boots Hono + TG poller(s) without error

## Customer surfaces (rubric F.T. + OSA)

- [x] `/api/chat` web endpoint with thread persistence
- [x] `/chat` page (Next.js) wired to `/api/chat`
- [x] `/menu` catalog page (server-rendered) + per-product pages
- [x] `/api/orders/draft` direct order endpoint (returns draft pending owner approval)
- [x] WhatsApp inbound webhook + outbound (sandbox; real gated on Meta creds)
- [x] Instagram inbound webhook + outbound (sandbox; real gated on Meta creds)
- [x] World scenario consumer (`bun run world:run`) processes events end-to-end

## Owner surfaces (rubric Operator Simulator)

- [x] Owner Telegram bot — `/today`, `/orders`, `/escalations`, `/reset`, `/help` (DB-backed, no LLM spend)
- [x] Inline-keyboard callbacks — `approve:<id>`, `reject:<id>`, `view_esc:<id>` → deterministic orchestration via `approveDraftAndPromote`
- [x] Free-text owner agent — `claude -p` with owner role + tools, multi-turn thread context
- [x] **Live streaming UX** — placeholder edited in place as agent emits `stream-json` events (`🤔` → `🛠 calling X` → final + tool footer)
- [x] **Auto-cards from MCP** — `create_draft_order` and `escalate_to_owner` post inline-keyboard cards to owner without polling
- [x] **Owner event log** — `📨` inbound, `✓` outbound w/ tool count + cost, `⚠` errors, `🔧` system; verbosity via `TG_OWNER_LOG_LEVEL`
- [ ] Multi-bot fan-out (`@hc_kitchen_bot`, `@hc_marketing_bot`, `@hc_concierge_bot`) — single owner bot covers all roles via free-text routing; multi-bot is rubric-preferred but not required

## Brand voice (rubric On-Site Assistant)

- [x] [src/agent/prompts/brand.md](../../src/agent/prompts/brand.md) — canonical voice rules condensed from [docs/00-source/BRANDBOOK.md](../00-source/BRANDBOOK.md) v1.0
- [x] `loadPrompt` in [src/agent/invoke.ts](../../src/agent/invoke.ts) prepends brand.md to customer-facing roles only (concierge, marketing); operator roles stay exempt
- [x] Verified live: smoke produces `cake "Honey"` format, `HappyCake` wordmark, soft CTA close

## Agent friendliness (rubric A.F.)

- [x] `/llms.txt` manifest
- [x] `/api/products` and `/api/products/:id`
- [x] `/openapi.json` exposes the public API surface
- [x] `/api/orders/draft` (POST) — direct order intent endpoint
- [x] `/api/policies` exposes pickup/delivery/lead time rules
- [ ] JSON-LD on every product page — handled by Next.js website
- [ ] `robots.txt` allowing GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot

## Marketing (rubric Business Analyst)

- [x] Hypothesis filled with margin math + expected ROAS per channel (`docs/01-product/HYPOTHESIS.md`)
- [x] 3 campaigns drafted via `marketing_create_campaign`
- [x] 1+ campaign launched in simulator via `marketing_launch_simulated_campaign`
- [x] Lead routing executed via `marketing_route_lead`
- [x] End-of-day report posted to owner via `marketing_report_to_owner`
- [x] Loop verified: `bun run marketing:run` lifts evaluator score to 100/100

## Evidence (rubric Innovation)

- [x] `bun run evidence` calls all 5 evaluator tools and returns total
- [x] `evaluator_score_marketing_loop` 100/100 ✅
- [x] `evaluator_score_pos_kitchen_flow` 100/100 ✅
- [x] `evaluator_score_world_scenario` 100/100 ✅
- [x] `evaluator_score_channel_response` 80/100 (gated on real WA outbound)
- [x] `evaluator_get_evidence_summary` snapshot in [docs/04-test/EVIDENCE.md](../04-test/EVIDENCE.md)
- [x] `bun run audit:hardcodes` — 0 findings (failsafe against -10 penalty)
- [x] `bun run repro` — 8/8 fresh-clone reproducibility

## Submission form

- [ ] Repo URL submitted at the SBC submission form
- [ ] Demo URL submitted (ngrok or named tunnel)
- [x] Team token kept private (never in repo, screenshots, demos) — verified by audit grep gates

---

## Pre-submission grep checks

Run these before tagging the final commit.

```bash
git grep -nE 'sbc_team_[a-f0-9]{32}'                        # must be empty
git grep -nE 'EAA[A-Za-z0-9_-]{40,}'                         # Meta tokens
git grep -nE 'sk-ant-'                                       # Anthropic keys
git grep -nE 'agent[_-]?sdk|langgraph|crewai' package.json   # banned deps
bun run audit:hardcodes                                      # scenario IDs / numbers
```
