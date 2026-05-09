# Submission checklist

Pulled from the hackathon brief §8 and the team kit. Tick when shipped; link to evidence.

---

## Repo hygiene

- [x] Public Git repository — `https://github.com/aissayev/sbc-hackathon`
- [x] Final commit before May 10, 10:00 CT
- [x] `.env.example` with placeholders only — `.env.example`
- [x] `.mcp.json.template` committed; `.mcp.json` gitignored
- [x] No secrets in repo (`git grep -nE 'sbc_team_[a-f0-9]{32}|sk-ant-' returns empty`)
- [x] README "Quick start" runs from a fresh clone — `README.md`

## Architecture & docs

- [x] `ARCHITECTURE.md` at root with component diagram
- [x] `AGENTS.md` mirroring CLAUDE.md / agent operating notes
- [x] `docs/INDEX.md` entry point
- [ ] `docs/01-product/HYPOTHESIS.md` filled with real numbers from `marketing_get_sales_history`
- [ ] `docs/04-test/ASSISTANT-SCRIPT.md` finalized
- [ ] `docs/04-test/SCENARIOS.md` 8 customer scenarios
- [ ] `docs/04-test/EVIDENCE.md` demo script

## Runtime

- [x] Agent runs on `claude -p` Opus 4.7 only (no SDK, no other LLM)
- [x] Owner UI is Telegram-only
- [x] Both MCPs configured (sandbox HTTP + local stdio)
- [x] `bun run smoke:agent "..."` passes
- [ ] `bun run typecheck` clean
- [ ] `bun run dev` boots Hono + 4 Telegram pollers without error

## Customer surfaces (rubric F.T. + OSA)

- [x] `/api/chat` web endpoint
- [ ] `/chat` page with assistant-ui island
- [ ] `/menu` catalog page (server-rendered, JSON-LD)
- [ ] `/menu/[slug]` per-product page
- [ ] `/track/[code]` order status page
- [ ] WhatsApp inbound + outbound
- [ ] Instagram inbound + outbound
- [ ] World scenario poller running

## Owner surfaces (rubric Operator Simulator)

- [ ] @hc_owner_bot — `/today`, `/orders`, `/escalations`, `/help`, daily digest, approval inline keyboards
- [ ] @hc_concierge_bot — passive log
- [ ] @hc_kitchen_bot — capacity warnings, ready pings
- [ ] @hc_marketing_bot — ROAS digest, approve_campaign

## Agent friendliness (rubric A.F.)

- [x] `/llms.txt` manifest
- [x] `/api/products` and `/api/products/:id`
- [ ] JSON-LD on every product page
- [ ] `robots.txt` allowing GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot
- [ ] `/openapi.json` exposes the public API surface
- [ ] Stable URLs (`/menu/<slug>`)

## Marketing (rubric Business Analyst)

- [ ] Hypothesis filled with margin math + expected ROAS per channel
- [ ] 3 campaigns drafted
- [ ] 1 campaign launched in simulator
- [ ] Lead routing executed
- [ ] End-of-day report posted to owner

## Evidence (rubric Innovation)

- [ ] `bun run evidence` writes `evidence/<ts>.json`
- [ ] `evaluator_score_marketing_loop` ≥70%
- [ ] `evaluator_score_pos_kitchen_flow` ≥70%
- [ ] `evaluator_score_channel_response` ≥70%
- [ ] `evaluator_score_world_scenario` ≥70%
- [ ] `evaluator_get_evidence_summary` snapshot saved

## Submission form

- [ ] Repo URL submitted at the SBC submission form
- [ ] Demo URL submitted (ngrok or named tunnel)
- [ ] Team token kept private (never in repo, screenshots, demos)

---

## Pre-submission grep checks

Run these before tagging the final commit.

```bash
git grep -nE 'sbc_team_[a-f0-9]{32}'                        # must be empty
git grep -nE 'EAA[A-Za-z0-9_-]{40,}'                         # Meta tokens
git grep -nE 'sk-ant-'                                       # Anthropic keys
git grep -nE '\b(8\.50|9\.50|55|95|120)\b' src/             # hardcoded prices (review hits)
git grep -nE 'agent[_-]?sdk|langgraph|crewai' package.json   # banned deps
```
