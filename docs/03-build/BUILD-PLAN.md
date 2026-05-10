# Build plan — T+0 → T+22h freeze (historical)

> **Status: post-execution.** This is the original 24-hour critical path written at T+0. It was executed and is preserved here as a record of the planned phasing. For the current submission state, see [CHECKLIST.md](CHECKLIST.md) and [docs/04-test/EVIDENCE.md](../04-test/EVIDENCE.md). For what's actually wired, see [docs/01-product/FEATURES.md](../01-product/FEATURES.md).

Submission deadline: **May 10, 10:00 CT.** Started: **May 9, 10:00 CT.** Internal freeze at T+22h leaves a 2h buffer before submission.

Owner shorthand: **A** = Adilet, **O** = Owner-side teammate, **C** = Customer-side teammate.

This is the critical path. If any block is at risk, *cut scope, don't slip the freeze*.

---

## Phase 1 — Spine (T+3.5h → T+8h, ~4.5h)

Goal: end-to-end customer flow on the website + WhatsApp + owner approval. **50 pts of rubric ride on this phase.**

| ID | Task | Owner | Doc / Code | Acceptance |
|---|---|---|---|---|
| P1.1 | Wire WhatsApp inbound (HMAC verify, normalize, ack 200 in <5s) | A | `src/routes/webhooks.ts` `src/channels/whatsapp.ts` | `whatsapp_inject_inbound` produces an `agent_invocations` row |
| P1.2 | Wire WhatsApp outbound via `whatsapp_send` MCP | A | concierge agent reply path | Reply lands in simulator thread |
| P1.3 | `bun run register-webhooks` script | A | `src/scripts/register-webhooks.ts` | Calls both register tools with `$PUBLIC_URL` |
| P1.4 | Owner Telegram bot: `/today`, `/orders`, `/help`, callback_query for approvals | O | `src/bots/owner/` (split: commands/callbacks/cards/live/log/format) | Inline `[Approve]/[Reject]` buttons fire `approveDraftAndPromote` (deterministic, no LLM) |
| P1.5 | Local MCP: `escalate_to_owner` posts to `@hc_owner_bot` directly | A | `src/agent/mcp/local-server.ts` | Escalation appears in owner bot within 5s |
| P1.6 | Concierge agent: custom-cake intake creates draft + escalates | C | `src/agent/prompts/concierge.md` + scenario test | "I want a Spider-Man cake for Saturday" → draft + escalation visible |
| P1.7 | Smoke run: customer (web) → draft → owner approves → kitchen ticket → ready | A+O | `bun run smoke:agent` + manual TG | All 4 steps succeed, audit trail clean |

**Exit criterion**: a single video-able demo of US-O2 (owner approves a custom order) and US-C2 (customer orders honey cake) on the same SQLite state.

## Phase 2 — Marketing closed loop (T+8h → T+12h, ~4h)

Goal: $500 → $5,000 hypothesis with a launched campaign and a report. **10 pts.**

| ID | Task | Owner | Doc / Code | Acceptance |
|---|---|---|---|---|
| P2.1 | Read `marketing_get_sales_history` + `marketing_get_margin_by_product` | C | manual notebook | Numbers in HYPOTHESIS.md |
| P2.2 | Write the hypothesis with channel allocation | C | `docs/01-product/HYPOTHESIS.md` | 3 campaigns specified, expected ROAS each |
| P2.3 | Marketing agent drafts 3 campaigns | C | `src/bots/marketing.ts` cron | 3 `marketing_create_campaign` calls visible in audit |
| P2.4 | Owner approves one in `@hc_marketing_bot` | O | bot inline KB | `marketing_launch_simulated_campaign` succeeds |
| P2.5 | Lead routing: `marketing_generate_leads` → `marketing_route_lead` × N | C | marketing agent | All routed leads have a `routeReason` |
| P2.6 | End-of-day report: `marketing_report_to_owner` | C | marketing agent cron | Summary posted to `@hc_owner_bot` at 20:00 owner-local |

**Exit criterion**: `evaluator_score_marketing_loop` returns ≥70%.

## Phase 3 — Agent-friendliness pass (T+12h → T+16h, ~4h)

Goal: AI customer can read the site without scraping. **15 pts.**

| ID | Task | Owner | Doc / Code | Acceptance |
|---|---|---|---|---|
| P3.1 | JSON-LD per `/menu/[slug]` page | C | `src/web/pages.ts` | `Product` schema with price, lead time, allergen |
| P3.2 | `robots.txt` allowlisting GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot, Bingbot | A | `src/web/pages.ts` route | `curl /robots.txt` shows allowlist |
| P3.3 | `/openapi.json` from Hono routes (zod-openapi) | A | `src/server.ts` | Lists `/api/products`, `/api/products/:id`, `POST /api/chat`, `GET /track/:code` |
| P3.4 | Brand the website (hero, palette, typography per BRANDBOOK) | C | `src/web/layout.ts` `pages.ts` | Mobile-first; no AI photos of cake; only approved assets |
| P3.5 | assistant-ui chat island on `/chat` | A | `src/web/chat-island/` + esbuild | Mounted, streams text + tool cards |
| P3.6 | `/track/[code]` order status page + embedded chat | A | `src/web/pages.ts` | Reads from `orders` + `kitchen_tickets`; iframe-embeddable |

**Exit criterion**: `curl /llms.txt` returns canonical URLs; AI evaluator can complete US-A3 (programmatic order) end-to-end.

## Phase 4 — Channel breadth + Instagram (T+16h → T+19h, ~3h)

Goal: Instagram fully wired; world scenario poller running. **15 pts split across F.T. and Innovation.**

| ID | Task | Owner | Doc / Code | Acceptance |
|---|---|---|---|---|
| P4.1 | Instagram inbound webhook (DM + comment) | A | `src/channels/instagram.ts` | Both event types normalize correctly |
| P4.2 | Instagram outbound: `instagram_send_dm`, `instagram_reply_to_comment` | A | concierge agent | Reply visible in IG thread/comment |
| P4.3 | World scenario poller (`world_next_event` cron) | A | `src/scripts/world-tick.ts` daemon | `launch-day-revenue-engine` runs to completion |
| P4.4 | Instagram post draft → owner approval → publish | A+O | concierge → `instagram_schedule_post`, owner bot → `instagram_approve_post` → `instagram_publish_post` | 1 post published in evidence |
| P4.5 | Google Business: `gb_simulate_post` + `gb_simulate_reply` to a review | A | gb agent or concierge subset | Visible in `gb_list_simulated_actions` |

**Exit criterion**: `evaluator_score_channel_response` ≥75%.

## Phase 5 — Evidence + final polish (T+19h → T+22h, ~3h)

Goal: capture proof; tighten weakest rubric line; submission-ready. **+10 Innovation, +final pass on Code Reviewer.**

| ID | Task | Owner | Doc / Code | Acceptance |
|---|---|---|---|---|
| P5.1 | `bun run evidence` — call all 4 `evaluator_score_*` + `evaluator_get_evidence_summary`, write `evidence/<ts>.json` | A | `src/scripts/evidence.ts` | File exists, scores ≥60% per line |
| P5.2 | Identify weakest rubric line, take 1h to lift it | A+O+C | depends | +5–8 pts on that line |
| P5.3 | Demo script (`docs/04-test/EVIDENCE.md`) | A | new doc | 5 step-by-step demos with curl/bun snippets |
| P5.4 | README final pass: setup correct from fresh clone | A | `README.md` | Run on a clean clone, follow steps blindly, no errors |
| P5.5 | ARCHITECTURE.md final pass: links current | A | `ARCHITECTURE.md` | Diagram still matches code |
| P5.6 | Capacity-aware recommender (concierge prefers SKUs with capacity) | C | concierge prompt | Visible in scenario tests |
| P5.7 | Brand-RAG: local MCP `brand_lookup` reads BRANDBOOK.md | A | `src/agent/mcp/local-server.ts` | Concierge can quote brand voice rules |

**Exit criterion**: submission ready. Repo clean, no secrets, smoke passes, evidence file present.

## Phase 6 — Submission window (T+22h → T+24h, 2h buffer)

Buffer for unexpected breakage. Only bug fixes. No new features. Final commit and submission form by T+24h.

---

## Critical-path risk register

| Risk | Probability | Mitigation |
|---|---|---|
| Tunnel URL changes; webhooks break | High | named Cloudflare Tunnel + `register-webhooks` on every boot |
| `claude -p` quota / Max throttling | Medium | warm-up early, watch costs in `agent_invocations` |
| Telegram bot tokens not ready | High | get all 4 in first hour |
| WA real creds expire mid-build | Medium | rely on `whatsapp_inject_inbound` for the demo path |
| SQLite write contention under scenario load | Low | WAL on, single-writer worker, retry-on-busy |
| Discovery: a tool we counted on doesn't exist or behaves differently | Medium | first phase smoke-tests every tool we use |

## What we explicitly cut

- Two-bot vs four-bot decision: **four**. Brief rewards "one bot per agent".
- Postgres / Redis: **not** for this build.
- Next.js / NestJS scaffold: **not**.
- Real Anthropic API key fallback: **not** required if laptop stays awake. Document for post-hackathon.
- Custom CMS for catalog: **no**, MCP `square_list_catalog` is canonical.
