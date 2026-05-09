# Personas

Five real users our system serves. Two more (kitchen, marketing-analyst) are *roles* the agent fulfills on behalf of the owner — they don't have their own UI.

---

## 1. Sugar Land Customer (primary)

**Who** — woman aged 25–65 with family, lives within 10 miles of Sugar Land, TX. Multicultural Houston metro. Drives everywhere.
**Why she comes** — birthday cake, weekend dessert, Mother's Day, office order, "homemade taste" without baking.
**Channels** — Instagram (most-discovered), WhatsApp (most-converted), website (consultative), walk-in (legacy).
**Friction today** — replies depend on owner's availability; Instagram is a window display, not a sales channel.
**Win condition** — she gets a clear answer in <2 min on any channel and an order placed without leaving that channel.
**Brand voice she expects** — emotional, witty, simple, humble, modern. (See [BRANDBOOK.md §2](../00-source/BRANDBOOK.md).)

## 2. AI Customer (the evaluator)

**Who** — automated agent driven by the hackathon evaluator that visits the website, reads the catalog, and tries to place orders.
**Why** — it scores Agent-Friendliness (15 pts).
**What it needs** — predictable URLs, JSON-LD, machine-readable prices/lead-times/capacity, no client-side hydration that hides product data, `/llms.txt` manifest, OpenAPI for the API surface.
**Win condition** — it can list products → pick one → know the lead time → reach order intent without a human.

## 3. Owner — Askhat

**Who** — non-technical operator running the Sugar Land bakery.
**Channel** — Telegram, *only*. No web dashboard, no email.
**What he wants from the system**
- Daily digest at 8 PM: today's orders, revenue, top complaint, marketing ROAS.
- Inline-keyboard approvals for: custom-cake intake, IG post drafts, marketing-campaign launches, complaint replies.
- One-tap commands: `/today`, `/orders`, `/escalations`, `/help`.
- Anomaly pings: kitchen capacity at risk, lead time slipping, complaint received.

**Win condition** — he runs the business in 10 phone-screen minutes per day.

## 4. Functional Tester (rubric-pass evaluator)

**Who** — automated process that injects WhatsApp messages, IG DMs, world-scenario events.
**What it does** — calls `whatsapp_inject_inbound`, `instagram_inject_dm`, `world_start_scenario` then `world_next_event` until the scenario ends; inspects `mcp_audit_log` and our local `agent_invocations` table.
**Win condition** — every channel produces an order intent that lands in our SQLite + the sandbox POS state.

## 5. Code Reviewer (rubric-pass evaluator)

**Who** — automated reader of the GitHub repo.
**What it does** — clones, follows README, runs `bun run smoke:agent`, inspects ARCHITECTURE.md, scans for secrets, reads per-role prompts.
**Win condition** — fresh-clone setup succeeds, structure is legible, no secrets, decomposition is visible (not buried in one mega-prompt).

---

## Personas the system represents but doesn't have a UI for

These are *agent roles*, executed via `claude -p` subprocesses with role-scoped tool allowlists. They surface to humans via Telegram bots or as draft outputs in the approval queue.

- **Kitchen coordinator** — accepts/rejects tickets based on `kitchen_get_capacity`; outputs reasons in concierge voice.
- **Marketing analyst** — reads sales history + margins, drafts campaigns, surfaces ROAS. Owner approves before launch.
- **Content creator** — drafts IG posts (image + caption); owner approves before publication via `instagram_approve_post` → `instagram_publish_post`.
