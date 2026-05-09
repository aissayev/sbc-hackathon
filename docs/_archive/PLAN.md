> **⚠️ Stale on stack — kept for reference only.**
>
> This plan was drafted before stack was chosen. It assumes pnpm + Turborepo + NestJS + Postgres + Redis + Telegraf + Cloudflare Tunnel.
>
> **The chosen stack is Bun + Hono + SQLite** (see [../README.md](../README.md), [../ARCHITECTURE.md](../ARCHITECTURE.md)).
>
> Still useful here: the rubric coverage table, the role-profile thinking, the data-model sketch (we use a leaner SQLite version of these tables), the idempotency-key idea for WA/IG webhook retries, and the audit-event pattern (we implement this in the `agent_invocations` SQLite table).
>
> **Do not implement the stack described below.** Use [../ARCHITECTURE.md](../ARCHITECTURE.md) as the source of truth.

---

# HappyCake — 24h build plan (original draft, stale on stack)

## Critical rules pulled from the brief (these change architecture choices)

- **Allowed runtime**: Claude Code CLI (`claude -p "<prompt>"`) on Opus 4.7 with the participant's own Claude Max. ngrok/Cloudflare Tunnel for inbound webhooks. Hackathon-hosted MCP only.
- **Disallowed**: **Claude Agent SDK**, LangGraph, CrewAI, n8n, other LLM providers, real production credentials.
- **Owner UI**: Telegram only. No web dashboard, no email. One Telegram bot per agent if multiple agents.
- **Web framework**: NestJS / Next.js are fine — only *agent* frameworks are banned.
- **Penalty**: hardcoded test answers cost 10 points and a public note.

→ The "where does Agent SDK fit?" question for this build: **nowhere**. SDK is the production option you'd reach for *outside* this hackathon when you don't want to shell out to a CLI. For this submission we use the headless `claude -p` bridge with role-scoped `--mcp-config` and `--allowed-tools`.

→ Claude Code CLI as a dev surface: yes — you (the operator) can `claude -p` against the same MCP and same project to drive the system manually. The official operator runtime is still Telegram.

## Judging rubric coverage (100 pts + bonus 10)

| Pass | Pts | Where we earn it |
|---|---|---|
| Functional Tester | 20 | Order-to-intent on every channel: web checkout, on-site assistant, WhatsApp, Instagram DM, comment-to-DM upgrade. World scenario events handled deterministically. |
| Agent-Friendliness | 15 | `/llms.txt`, `/api/agent/manifest.json`, JSON-LD per product, stable `/menu/<slug>` URLs, machine-readable policy/availability snippets, robots.txt allowing AI crawlers. |
| On-Site Assistant | 15 | Web chat does: consultation, custom-cake intake (creates ApprovalRequest), complaints (escalation to Operator bot), order status by code, capacity-aware availability. Cites MCP evidence; never invents. |
| Code Reviewer | 10 | Single-clone README, ARCHITECTURE.md with diagram, `.env.example` placeholders only, no secrets, demo scripts. |
| Operator Simulator | 15 | Operator Bot: daily digest, IG-post approve/edit/reject taps, custom-order approval, complaint triage with one-tap reply, ROAS alerts, kitchen at-risk pings. |
| Business Analyst | 10 | Marketing plan derived from `marketing_get_sales_history` × `marketing_get_margin_by_product` (whole-honey-cake at 62% margin × $55 = best $/order; office-dessert-box catering at 60% × $120 = best $/customer). Hypothesis: spend-per-channel rationale, expected leads, CAC, payback. |
| Innovation | +10 | Agent-friendly site as a first-class artifact, capacity-aware recommender, evaluator self-score in CI, "ask the brand" RAG over the brandbook. |
| Penalty avoidance | -10 → 0 | Everything reads MCP at request time; nothing hardcoded. |

## Architecture (one orchestrator, multiple bots, role-scoped CC CLI calls)

```
┌────────────────────── Channels ──────────────────────┐
│ Web (Next.js)   WA webhook  IG webhook  Telegram bots │
│  ▲ on-site      ▲           ▲           ▲ Operator    │
│  │ assistant    │            │           ▲ Marketing   │
└──┼──────────────┼────────────┼───────────┼────────────┘
   │              │            │           │
   ▼              ▼            ▼           ▼
        Channel adapters (NestJS modules)
                 ▼
       Inbound normalizer → Postgres (events, conversations, orders)
                 ▼
        ┌──── Router ──────────────────┐
        │ stamps actor_role,           │
        │ channel, intent_class,       │
        │ idempotency_key (Redis)      │
        └────┬──────────────────────┬──┘
             │                      │
             ▼                      ▼
   CC CLI runner (subprocess)  Approval queue (DB)
   spawn `claude -p` with                ▼
   role-scoped --mcp-config       Operator Bot prompts
   and --allowed-tools           owner taps Approve/Edit/Reject
             │                            │
             ▼                            ▼
   MCP tool calls (square_*, kitchen_*, marketing_*, ig_*, wa_*, gb_*, world_*, evaluator_*)
             │
             ▼
   Outbound dispatcher → channel adapters → customer/owner
             │
             ▼
   AuditEvent rows + JSONL evidence/  (for evaluator)
```

### Why one orchestrator, not two
Owner-vs-customer is a *role*, not a separate brain. Routing it through one orchestrator with role-scoped prompts and tool profiles keeps the CC CLI invocation pattern uniform, avoids drift between codepaths, and lets the rubric's "evidence" emerge from a single audit trail. The brief's "one bot per agent" rule is satisfied by separate Telegram bot tokens — not by separate codebases.

### Role profiles (each is a `--mcp-config` + system prompt + allow-list)
- **customer-assistant** (web/WA/IG inbound): read catalog, check inventory, check kitchen capacity, create order intent, escalate. Cannot publish posts, cannot launch campaigns.
- **operator** (Telegram inbox): full read, approval mutations (`instagram_approve_post`, `marketing_launch_simulated_campaign` after approval), reply via `whatsapp_send`/`instagram_send_dm`, force-route complaints.
- **marketing-strategist** (proactive, scheduled): read sales history + margins, draft campaigns, simulate with approval, route leads, report to owner.
- **kitchen-coordinator**: accept/reject/ready tickets based on capacity; auto-rejects with reasons that the customer-assistant relays in voice.
- **content-creator**: draft IG posts, never publishes. Goes through approval queue.

### CC CLI invocation pattern (replaces Agent SDK)
```
claude -p "$PROMPT" \
  --mcp-config "configs/mcp.${role}.json" \
  --allowed-tools "$TOOLS_FOR_ROLE" \
  --output-format stream-json \
  --model claude-opus-4-7 \
  --max-turns 8
```
- Stateless per request; we feed the conversation history as part of the prompt.
- One Redis idempotency key per (channel, externalMessageId) prevents double-handling.
- Each spawn writes an AuditEvent with stdout, stderr, tool calls, and cost.
- We expose `npm run agent:owner` etc. so a developer can `claude -p` interactively against the same configs.

## Stack

- **Monorepo**: pnpm + Turborepo
- **`apps/web`**: Next.js 15 (App Router, Server Components, Tailwind, shadcn). Mobile-first. The future `happycake.us`. Hosted on Vercel.
- **`apps/api`**: NestJS (Fastify) on Node 22. Modules: `channels/{web,wa,ig,gb,telegram}`, `orchestrator`, `agents`, `kitchen`, `marketing`, `square`, `world`, `evaluator`, `audit`. Hosted on Fly.io (or local + Cloudflare Tunnel during dev).
- **`apps/worker`**: BullMQ worker for scenario polling, daily digests, campaign metric refresh, idle-customer follow-up.
- **DB**: Postgres + Prisma. (Existing `.env.example` mentions SQLite — let's confirm the switch.)
- **Cache/Queue**: Redis (Upstash free tier OK). Used for BullMQ + idempotency keys.
- **Tunnel**: Cloudflare Tunnel (more stable than ngrok for the demo).
- **Bots**: `telegraf` lib. Two bots day 1: `OperatorBot` + `MarketingBot`. (Add `KitchenBot`/`ConciergeBot` later only if it earns points.)
- **Tracing**: pino → JSONL files in `evidence/`, plus `mcp_audit_log` rows.

## Data schema (Prisma sketch — to confirm)

```prisma
model Product {
  id                  String   @id           // honey-cake-slice
  squareItemId        String   @unique
  variationId         String   @unique
  name                String
  category            String                 // slices|whole-cakes|catering|custom
  priceCents          Int
  estMarginPct        Float
  prepMinutes         Int
  leadTimeMin         Int
  capacityPerDay      Int
  requiresCustomWork  Boolean
  description         String
  heroImage           String?
  galleryImages       String[]
  agentNotes          String?                // brand-voice short copy
  syncedAt            DateTime @default(now())
  active              Boolean  @default(true)
}

model Customer {
  id            String   @id @default(cuid())
  channel       String
  externalId    String?
  name          String?
  phone         String?
  email         String?
  preferredLang String   @default("en")
  notes         String?
  createdAt     DateTime @default(now())
  conversations Conversation[]
  orders        Order[]
  @@unique([channel, externalId])
}

model Conversation {
  id               String   @id @default(cuid())
  customerId       String
  channel          String           // website|whatsapp|instagram|telegram-owner|gb_review
  externalThreadId String?
  status           String   @default("open")    // open|escalated|resolved
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  messages         Message[]
  customer         Customer @relation(fields: [customerId], references: [id])
}

model Message {
  id             String   @id @default(cuid())
  conversationId String
  direction      String           // inbound|outbound
  authorRole     String           // customer|agent|owner|kitchen|marketing|system
  body           String
  meta           Json?            // { tool_calls, citations, model, cost, duration_ms }
  createdAt      DateTime @default(now())
  conversation   Conversation @relation(fields: [conversationId], references: [id])
}

model Order {
  id                String   @id @default(cuid())     // local id (also our trackingCode)
  squareOrderId     String?  @unique                   // returned by square_create_order
  customerId        String?
  source            String                              // website|whatsapp|instagram|walk-in|agent
  status            String                              // intent|created|kitchen_pending|kitchen_accepted|ready|completed|cancelled|rejected
  items             Json                                // [{variationId, quantity, note}]
  subtotalCents     Int
  customerName      String?
  customerNote      String?
  requestedPickupAt DateTime?
  trackingCode      String   @unique                    // hc-xxx-yyy short code for status widget
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  ticket            KitchenTicket?
  customer          Customer? @relation(fields: [customerId], references: [id])
}

model KitchenTicket {
  id                 String   @id @default(cuid())
  remoteId           String?  @unique                   // from kitchen_create_ticket
  orderId            String   @unique
  status             String                              // queued|accepted|rejected|ready|completed
  rejectReason       String?
  acceptedAt         DateTime?
  readyAt            DateTime?
  notes              String?
  items              Json
  customerName       String
  requestedPickupAt  DateTime?
  createdAt          DateTime @default(now())
  order              Order   @relation(fields: [orderId], references: [id])
}

model Campaign {
  id              String   @id @default(cuid())
  remoteId        String?  @unique
  name            String
  channel         String
  objective       String
  budgetUsd       Float
  targetAudience  String
  offer           String
  landingPath     String?
  status          String                                  // draft|approved|launched|paused|completed
  approvedBy      String?
  approvedAt      DateTime?
  metricsSnapshot Json?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  leads           Lead[]
}

model Lead {
  id                String   @id @default(cuid())
  remoteId          String?  @unique
  campaignId        String?
  source            String
  intent            String?
  contact           Json?
  routedTo          String?
  routeReason       String?
  customerId        String?
  convertedOrderId  String?
  createdAt         DateTime @default(now())
  campaign          Campaign? @relation(fields: [campaignId], references: [id])
}

model ApprovalRequest {
  id          String   @id @default(cuid())
  kind        String                                       // ig_post|campaign|custom_order|complaint_response
  refId       String                                       // FK to the thing pending approval
  payload     Json                                         // draft text, image url, args
  status      String   @default("pending")                 // pending|approved|edited|rejected
  decidedBy   String?                                       // telegram user id
  decidedAt   DateTime?
  ownerNote   String?
  createdAt   DateTime @default(now())
}

model ScenarioRun {
  id          String   @id @default(cuid())
  scenarioId  String                                       // launch-day-revenue-engine | weekend-capacity-crunch
  seed        Int?
  startedAt   DateTime @default(now())
  endedAt     DateTime?
  events      ScenarioEvent[]
}

model ScenarioEvent {
  id         String   @id @default(cuid())
  runId      String
  channel    String
  type       String
  priority   String?
  payload    Json
  receivedAt DateTime @default(now())
  handledBy  String?
  handledAt  DateTime?
  result     Json?
  run        ScenarioRun @relation(fields: [runId], references: [id])
}

model AuditEvent {
  id              String   @id @default(cuid())
  actor           String                                  // role name | owner | system | evaluator
  channel         String?
  conversationId  String?
  toolName        String?
  toolArgs        Json?
  toolResult      Json?
  ccRunId         String?                                 // claude -p run id
  promptHash      String?
  outcome         String?                                 // success|error|escalated
  costUsd         Float?
  durationMs      Int?
  createdAt       DateTime @default(now())
}
```

### Sync rules
- **Pull on boot + every 10 min**: catalog, menu constraints, capacity, budget, margins, sales history. Updates `Product` rows.
- **Write-through**: every `square_create_order` / `kitchen_create_ticket` / `marketing_create_campaign` is wrapped — store local row first, call MCP, fill in `remoteId`.
- **Reconcile every 30 s while a scenario is active**: `square_recent_orders`, `kitchen_list_tickets`, `marketing_get_campaign_metrics` → upsert.
- **World inbound**: `world_next_event` poller → normalizer → router (no webhook required).
- **Idempotency**: `(channel, externalMessageId)` SHA in Redis prevents replays from the evaluator.

## Customer order-tracking widget

- Each order gets a `trackingCode` (e.g., `hc-7Q4-2K1`) printed on the confirmation.
- `/track/<code>` is a public, server-rendered Next.js page that shows status pulled from the local `Order` and `KitchenTicket`, plus an embedded chat back to the on-site assistant pre-scoped to that order.
- Same widget is embeddable as `<iframe src="/track/<code>?embed=1">` for the customer's own bookmark / WhatsApp deep-link.

## What I still need from you to start scaffolding

(See AskUserQuestion that follows this doc.)
