# Backend build plan — iterative PR workflow

**Audience:** the agent picking this up after `/compact`. **Owner:** Adilet.
**Workflow:** trunk-based on `main`, one feature = one PR, 5-minute approval window, auto-proceed if no objection.

> This plan is self-contained. Read it, read [CLAUDE.md](../CLAUDE.md), [README.md](../README.md), [ARCHITECTURE.md](../ARCHITECTURE.md), [docs/MCP-PRIMER.md](MCP-PRIMER.md), [docs/DATA-MODEL.md](DATA-MODEL.md), [docs/SECURITY.md](SECURITY.md), [docs/WEBSITE-DELEGATION.md](WEBSITE-DELEGATION.md). Then start Phase 1.

---

## What's already done (do not redo)

- ✅ `claude -p` subprocess wrapper with stream-json parsing, per-role tool allowlist, 24-tool denylist, audit log to SQLite
- ✅ Sandbox HTTP MCP + local stdio MCP wired via `.mcp.json.template` → `bun run setup:mcp`
- ✅ 4 role prompts: concierge, kitchen, marketing, owner
- ✅ Per-role CLI: `bun run agent:<role> "<msg>"`
- ✅ Channels: WhatsApp, Instagram, Telegram (multi-bot fan-out), Web (in-process queue)
- ✅ Webhook routes: `/webhooks/whatsapp`, `/webhooks/instagram`
- ✅ Public catalog API: `/api/products`, `/api/products/:id`, `/llms.txt`, `/openapi.json`
- ✅ Public chat API: `/api/chat`, `/test/incoming` (eval entrypoint)
- ✅ Server-rendered website (will be replaced by `web/` Next.js app — keep until then)
- ✅ Catalog seeded: 5 real products from sandbox snapshot
- ✅ Local MCP tools: list_products, check_constraints, create_draft_order, get_order_status, escalate_to_owner, list_orders, list_escalations, approve_order, reject_order, daily_report, queue_owner_approval, notify_customer
- ✅ Documentation: README, ARCHITECTURE, AGENTS, CLAUDE, MCP-PRIMER, DATA-MODEL, HOW-INVOKE-WORKS, SECURITY, DEPLOY, AGENT-SDK-RETROFIT, TELEGRAM-AND-MINI-APP, WEBSITE-DELEGATION
- ✅ Smoke verified live: brand voice ✓, tool calls ✓, security fences ✓ (out-of-scope ask declined)
- ✅ `.gitignore` excludes `.env.local`, `.mcp.json`, `.data/`, `docs/sandbox/` (NDA), `docs/STATUS.md`, `web/node_modules`, `web/.next`

## What's NOT done (this plan)

Phases 1-7 below. Each phase = one or more features. Each feature = one PR.

---

## Workflow rules

1. **One feature per PR.** Don't bundle.
2. **Branch naming:** `feat/<phase>-<short-name>`, e.g. `feat/p1-policies-endpoint`.
3. **PR title:** imperative, under 70 chars. `feat(p1): /api/policies endpoint`
4. **PR body:** what / why / files changed / how to verify (1 command).
5. **After opening PR:** post a chat message to Adilet — "PR #X: <title>. 5-min review window. Comment to block; silence merges."
6. **Wait 5 minutes** (use the wakeup mechanism). If a comment arrives, address it. If silent, merge to main and move to next feature.
7. **Every PR must pass:** `bun run typecheck` AND `bun run smoke:agent "..."` (or relevant role smoke).
8. **Never commit:** `.env.local`, `.mcp.json`, `.data/`, `docs/sandbox/*`, `docs/STATUS.md`, secrets in any form.
9. **No SDK imports.** No `@anthropic-ai/claude-agent-sdk` ever. Hard fail.
10. **Reject-with-reason:** if a feature is blocked on a missing token / external dep, post the blocker in chat and skip ahead.

## How to run the wait

```bash
# After pushing PR:
gh pr view <num> --web   # show URL in chat
# Then wait 5 min using ScheduleWakeup or sleep loop, then:
gh pr merge <num> --squash --auto    # set auto-merge if approval gate
# Or if no protection:
git checkout main && git pull && git merge --ff-only origin/feat-branch
```

(No PR protection set up on this repo; direct merge is fine. Use PR primarily for review traceability + the 5-min window.)

---

## Phase 1 — Customer order endpoints (web → backend)

The website at `web/` (Next.js, separate agent) needs these to render the order flow.

### Feature 1.1 — `GET /api/policies`
- **Files:** `src/server.ts` (add route), `src/domain/policies.ts` (new)
- **Spec:** returns lead times, fulfillment, payment, allergen protocol, cancellation. Reads from a constants file.
- **Verify:** `curl localhost:3000/api/policies | jq` returns valid JSON.
- **PR #1**

### Feature 1.2 — `POST /api/orders/draft`
- **Files:** `src/server.ts` (add route), `src/domain/tools.ts` (already has `createDraftOrder` — wrap it).
- **Spec:** accepts `{ items, scheduled_at, customer_name, customer_phone, notes, channel: 'web' }`. Validates with Zod. Calls `createDraftOrder()`. Fires `escalate_to_owner` (or queues a TG notification directly via the owner bot if token configured). Returns `{ order_id, total_cents, status: 'draft' }`.
- **Verify:** `curl -X POST localhost:3000/api/orders/draft -d '{"items":[{"product_id":"honey-cake-slice","quantity":2}],"customer_name":"Test","channel":"web"}'` returns ok.
- **PR #2**

### Feature 1.3 — `GET /api/orders/:id`
- **Files:** `src/server.ts`.
- **Spec:** returns `{ id, status, total_cents, scheduled_at, customer_name, kitchen_ticket_id }`. Order ID is the secret — no auth.
- **Verify:** create draft via 1.2, then GET returns it.
- **PR #3**

### Feature 1.4 — Telegram owner notification on new draft
- **Files:** `src/domain/tools.ts` (extend `createDraftOrder` or post-step), `src/channels/telegram.ts` (use `sendTelegram` with inline keyboard).
- **Spec:** when draft created, send to `TG_OWNER_CHAT_ID` via `TG_OWNER_BOT_TOKEN` with text "New draft #ord_X — $Y for `<customer>`. Items: ..." + inline keyboard `[Approve] [Reject]` with callback data `approve:<id>` / `reject:<id>`.
- **Verify:** post a draft, watch Telegram chat for the buttons. Skip if owner token not set.
- **PR #4**

---

## Phase 2 — Owner approve/reject orchestration

The hot path: owner taps "Approve" → we promote local draft to sandbox (Square + Kitchen) → notify customer.

### Feature 2.1 — Approve callback handler
- **Files:** `src/server.ts` (callback router — already has skeleton; wire to a new function), `src/domain/orders.ts` (new) — `approveDraftAndPromote(orderId)`.
- **Spec:** owner taps `approve:<id>`. Wrapper calls `approveDraftAndPromote(id)`:
  1. Read draft from local SQLite.
  2. Call sandbox `square_create_order` with items + source.
  3. Call sandbox `kitchen_create_ticket` with returned square_order_id + customer_name + items.
  4. **On success:** update local row → `status='approved'`, store `square_order_id` + `kitchen_ticket_id`. Send "Approved & in kitchen" message to owner. Notify customer via their original channel.
  5. **On failure:** leave local status='draft', notify owner with the error, do NOT update.
- **How to call sandbox tools from non-agent code?** Two options:
  - (A) Spawn `claude -p` in `kitchen` role with a structured prompt: "Approve order X — call square_create_order then kitchen_create_ticket. Return JSON `{square_order_id, ticket_id}`." Use `--json-schema`.
  - (B) Direct HTTP call to the MCP endpoint (we have the URL + token). Bypasses claude entirely — faster, deterministic.
  - **Pick B** for this hot path. Keep claude for natural-language replies; use direct MCP for orchestration.
  - Add `src/lib/sandbox-mcp.ts` — a small client: `callSandboxTool(toolName, args)` → POSTs JSON-RPC to `https://www.steppebusinessclub.com/api/mcp` with `X-Team-Token`.
- **Verify:** approve a draft via TG button, confirm sandbox `square_get_pos_summary` shows the new order.
- **PR #5**

### Feature 2.2 — Reject-with-reason callback
- **Files:** same as 2.1.
- **Spec:** owner taps `reject:<id>` → bot replies "Reason?" with `force_reply: true` → next message in that chat captured as the reason → call `reject_order(id, reason)` → notify customer with the reason in brand voice.
- **State:** track "awaiting_reason_for" map in memory keyed by chat id (or in a new `pending_callbacks` SQLite table — pick the simpler one for now).
- **Verify:** reject a draft, type a reason, confirm customer gets notified.
- **PR #6**

### Feature 2.3 — Customer notification on kitchen ready
- **Files:** `src/server.ts` (poll/listen for kitchen_mark_ready events OR a webhook from sandbox), `src/channels/<all>.ts`.
- **Spec:** when kitchen marks ready, customer's original channel gets a "your cake is ready" message. The sandbox's `kitchen_mark_ready` is called by us elsewhere (from kitchen role agent or admin UI). On that call, also: look up our local order by `kitchen_ticket_id`, get `thread_id` + `channel`, send via the right adapter.
- **Verify:** call `kitchen_mark_ready` on a ticket, confirm customer adapter sends.
- **PR #7**

---

## Phase 3 — Admin endpoints + Telegram initData auth

The website at `web/admin/*` (and the Telegram Mini App) needs these.

### Feature 3.1 — Telegram initData verification middleware
- **Files:** `src/lib/telegram-auth.ts` (new), `src/routes/admin.ts` (new).
- **Spec:** Hono middleware that reads `X-Telegram-Init-Data` header, verifies HMAC-SHA256 against `TG_OWNER_BOT_TOKEN`, rejects with 401 if invalid. Adds `c.set('tgUser', userObj)` for downstream handlers.
- **Reference:** [docs/TELEGRAM-AND-MINI-APP.md §2](TELEGRAM-AND-MINI-APP.md).
- **Verify:** unit test (or manual) — known-good initData passes; tampered fails.
- **PR #8**

### Feature 3.2 — `GET /api/admin/today`
- **Files:** `src/routes/admin.ts`.
- **Spec:** returns daily report — orders, revenue, pending approvals, open escalations, kitchen summary (from `kitchen_get_production_summary` sandbox tool). Calls `dailyReport()` (local) + sandbox tool via `sandbox-mcp.ts`.
- **PR #9**

### Feature 3.3 — `GET /api/admin/orders` + `GET /api/admin/orders/:id`
- **Files:** `src/routes/admin.ts`.
- **Spec:** list view with status filter; detail view includes thread transcript (from `threads` table) + sandbox order data.
- **PR #10**

### Feature 3.4 — `POST /api/admin/orders/:id/approve` + `/reject`
- **Files:** `src/routes/admin.ts`.
- **Spec:** same orchestration as Phase 2 callbacks but triggered from web button. Reuse `approveDraftAndPromote()`.
- **PR #11**

### Feature 3.5 — `GET /api/admin/escalations` + `POST /api/admin/escalations/:id/resolve`
- **Files:** `src/routes/admin.ts`.
- **Spec:** queue + mark-resolved.
- **PR #12**

---

## Phase 4 — Marketing hypothesis with live numbers

### Feature 4.1 — Live $500→$5,000 hypothesis
- **Files:** `docs/hypothesis.md` (rewrite), `src/scripts/hypothesis.ts` (new — generates the doc).
- **Spec:** spawn marketing role agent: "Read `marketing_get_sales_history` and `marketing_get_margin_by_product`. Compute expected return per channel allocation under our $500 budget. Write the hypothesis as markdown matching the template at `docs/hypothesis.md`." Capture output, save to `docs/hypothesis.md`.
- **Verify:** numbers replace TBDs, math passes sniff-check.
- **PR #13**

---

## Phase 5 — World scenario integration

### Feature 5.1 — World scenario consumer
- **Files:** `src/scripts/world-run.ts` (new).
- **Spec:** loop `world_next_event` every 1s; for each event:
  - If channel = whatsapp/instagram: convert to `IncomingMessage`, route through `onMessage` (so it goes to claude -p just like a real customer would).
  - If channel = google_business: send to GBP simulator via `gb_simulate_reply`.
  - If type = `kitchen.ready`: trigger Phase 2.3.
- **Verify:** `bun run world:start` then `bun run world:run` — see events processed, agent replies happen.
- **PR #14**

---

## Phase 6 — Eval baseline + tighten

### Feature 6.1 — Run evaluator preview
- **Files:** none (use existing `bun run evidence`).
- **Spec:** run after Phase 5 has generated activity; capture output to `docs/eval-baseline-<timestamp>.md` (gitignored — internal). Identify weakest rubric line.
- **No PR; chat update.**

### Feature 6.2 — Tighten weakest line
- **Files:** depends on which line is weak (likely concierge prompt or marketing campaign payload).
- **PR #15**

### Feature 6.3 — Re-run eval, repeat 6.1+6.2 until time runs out

---

## Phase 7 — Submission package

### Feature 7.1 — `evaluator_generate_team_report`
- **Files:** `src/scripts/submission.ts`.
- **Spec:** spawn owner agent: "Call evaluator_generate_team_report with repoUrl=<our github>, websiteUrl=<deploy url>, notes=<one-paragraph summary>." Capture output, paste into PR description for the final commit.
- **PR #16**

### Feature 7.2 — Hardcode-grep audit
- **Files:** `src/scripts/audit-hardcodes.ts`.
- **Spec:** grep for: scenario IDs in source, magic numbers matching catalog prices, hardcoded customer names. Fail if any found in `src/**`.
- **PR #17**

### Feature 7.3 — Final readme polish
- **Files:** `README.md`.
- **Spec:** update "what's wired" table, add deploy URLs, add eval baseline numbers, add team credits.
- **PR #18**

---

## Time budget (revised estimate)

| Phase | Features | Time |
|---|---|---|
| 1 | Customer endpoints | 1.5h |
| 2 | Owner approve/reject orchestration | 2h |
| 3 | Admin endpoints + Telegram auth | 2h |
| 4 | Marketing hypothesis | 0.5h |
| 5 | World scenario consumer | 1.5h |
| 6 | Eval iterate (3-5 cycles × 30min) | 2h |
| 7 | Submission package | 0.5h |
| **Total** | **~18 PRs** | **~10 hours** |

---

## Failure modes to watch

1. **Sandbox MCP rate limits.** If `square_create_order` 429s, back off + retry. Don't loop hard.
2. **Claude Max budget exhaustion.** Track `agent_invocations.cost_usd` rolling sum. If >$25 spent in an hour, reduce eval iteration tempo.
3. **Telegram bot 401.** Token expired? Or wrong bot token? Confirm via `getMe`.
4. **Webhook URL changes (ngrok restart).** Re-register via `whatsapp_register_webhook` and `instagram_register_webhook` after every ngrok restart.
5. **GitHub API rate limits.** Likely fine at our PR rate. If hit, slow down between PRs.

---

## Done criteria for the whole plan

- [ ] All 18 PRs merged to main
- [ ] `bun run typecheck` green on main
- [ ] `bun run agent:concierge "smoke"` works
- [ ] `bun run agent:owner "/today"` returns real numbers
- [ ] `bun run evidence` returns evaluator scores ≥70/100
- [ ] Repo is public on GitHub
- [ ] Final commit before May 10 10:00 CT
- [ ] Submission notes in PR description of final commit
