// Local stdio MCP server — exposes Happy Cake domain tools to the agent.
//
// Run standalone (debug):  bun src/agent/mcp/local-server.ts
// Mounted by Claude Code via .claude/mcp.json under the name "local".
//
// Why local AND sandbox MCPs?
//   - Sandbox MCP (https://www.steppebusinessclub.com/api/mcp) is the source
//     of truth at runtime: real Square catalog, kitchen capacity, marketing.
//   - Local MCP owns OUR state: drafted orders, threads, escalations,
//     daily reports. The sandbox doesn't know about our website's threads.
//   - Both live in the same `.claude/mcp.json` and are equally addressable
//     from a single `claude -p` invocation.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'
import {
  listProducts,
  listProductsSchema,
  checkConstraints,
  checkConstraintsSchema,
  createDraftOrder,
  createDraftOrderSchema,
  getOrderStatus,
  getOrderStatusSchema,
  escalate,
  escalateSchema,
  listOrders,
  listEscalations,
  dailyReport,
} from '../../domain/tools.ts'
import { approveDraftAndPromote, rejectDraft } from '../../domain/order-orchestration.ts'
import { getPolicies } from '../../domain/policies.ts'
import {
  postDraftOrderCard,
  postEscalationCard,
  postRefundRequestCard,
} from '../../bots/owner/index.ts'
import { brandLookup, brandLookupSchema } from './brand-rag.ts'
import { createApproval } from '../../domain/approvals.ts'
import {
  findCustomerByPhone,
  findCustomerByThread,
  getCustomerById,
  listCustomerOrders,
  mergeCustomers,
  normalizePhone,
} from '../../domain/customers.ts'
import {
  requestRefund,
  requestRefundSchema,
  approveRefund,
  denyRefund,
  listRefunds,
} from '../../domain/refunds.ts'

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] }
}

const server = new McpServer({ name: 'happycake-local', version: '0.1.0' })

server.registerTool(
  'list_products',
  {
    description: 'List Happy Cake US products from the local catalog mirror. Filter by category and stock.',
    inputSchema: listProductsSchema.shape,
  },
  async (args) => ok(listProducts(args as z.infer<typeof listProductsSchema>)),
)

server.registerTool(
  'check_constraints',
  {
    description: 'Validate that a product can be ordered for a given ISO datetime. Returns earliest_iso if not.',
    inputSchema: checkConstraintsSchema.shape,
  },
  async (args) => ok(checkConstraints(args as z.infer<typeof checkConstraintsSchema>)),
)

server.registerTool(
  'create_draft_order',
  {
    description:
      'Create a draft order pending owner approval. Returns { order_id (long internal key, never shown to customers), friendly_id (short number like "1042" — quote this to the customer as `#1042`), total_cents }.',
    inputSchema: createDraftOrderSchema.shape,
  },
  async (args) => {
    const result = createDraftOrder(args as z.infer<typeof createDraftOrderSchema>)
    if (result.ok && result.order_id) {
      // Fire-and-forget: notify the owner in TG with an "Approve / Reject" card.
      // No-op when owner bot isn't configured. Never throws.
      postDraftOrderCard(result.order_id).catch((err) =>
        console.error('[local-mcp] postDraftOrderCard failed:', (err as Error).message),
      )
    }
    return ok(result)
  },
)

server.registerTool(
  'get_order_status',
  {
    description:
      'Look up status of a HappyCake order. Accepts the friendly number ("1042", "#1042", or legacy "HC-1042") or the full canonical id ("ord_…"). Customers will usually paste the short number.',
    inputSchema: getOrderStatusSchema.shape,
  },
  async (args) => ok(getOrderStatus(args as z.infer<typeof getOrderStatusSchema>)),
)

server.registerTool(
  'escalate_to_owner',
  {
    description:
      'Hand a thread to Askhat (the owner). Use for complaints, refunds, custom-cake design, allergen-critical requests, or anything the agent should not decide alone.',
    inputSchema: escalateSchema.shape,
  },
  async (args) => {
    const parsed = args as z.infer<typeof escalateSchema>
    const result = escalate(parsed)
    if (result.ok && result.escalation_id) {
      // Surface the escalation as a TG card so the owner doesn't have to poll.
      postEscalationCard(result.escalation_id, parsed.reason, parsed.severity).catch((err) =>
        console.error('[local-mcp] postEscalationCard failed:', (err as Error).message),
      )
    }
    return ok(result)
  },
)

server.registerTool(
  'list_orders',
  {
    description: 'List recent orders (owner-only). Filter by status.',
    inputSchema: { status: z.string().optional(), limit: z.number().int().positive().optional() },
  },
  async (args) => ok(listOrders(args as { status?: string; limit?: number })),
)

server.registerTool(
  'list_escalations',
  {
    description: 'List recent escalations (owner-only). Filter by status (open/resolved/dismissed).',
    inputSchema: { status: z.string().optional() },
  },
  async (args) => ok(listEscalations(args as { status?: string })),
)

server.registerTool(
  'approve_order',
  {
    description:
      'Owner-only. Promote a draft to a Square order + kitchen ticket atomically. Call this for any draft the owner says yes to — do not flip SQLite status by other means.',
    inputSchema: { order_id: z.string(), note: z.string().optional() },
  },
  async (args) => {
    const { order_id } = args as { order_id: string; note?: string }
    // Note: `note` is currently captured at the UI layer (TG callback handler);
    // approveDraftAndPromote is intentionally deterministic and doesn't take a
    // free-text note to keep the audit trail clean.
    const result = await approveDraftAndPromote(order_id)
    return ok(result)
  },
)

server.registerTool(
  'reject_order',
  {
    description: 'Owner-only. Reject a draft order, capturing the reason for the customer.',
    inputSchema: { order_id: z.string(), reason: z.string() },
  },
  async (args) => {
    const { order_id, reason } = args as { order_id: string; reason: string }
    const result = await rejectDraft(order_id, reason)
    return ok(result)
  },
)

// ─── Refund flow ────────────────────────────────────────────────────────
//
// Customer-initiated refunds. The concierge agent calls `request_refund`
// when a customer asks; the owner approves or denies via the TG card
// posted by `postRefundRequestCard`. `approve_refund` / `deny_refund`
// are owner-only and intended for the TG callback path, but exposing them
// as MCP tools makes them scriptable + lets the owner agent reason about
// pending refunds in free-text turns.

server.registerTool(
  'request_refund',
  {
    description:
      'Customer-initiated refund. Use when a customer asks for a refund on a specific order. Pass the EXACT order_id (starts with `ord_`), the customer\'s thread_id + channel, and a short reason quoting the customer. Creates a pending refund request, flips the order to `refund_pending`, and posts an Approve/Deny card to Askhat in Telegram. NEVER promise the refund will be granted — Askhat decides. If the order is already in refund_pending or refunded, the tool returns the existing refund_id (idempotent).',
    inputSchema: requestRefundSchema.shape,
  },
  async (args) => {
    const parsed = args as z.infer<typeof requestRefundSchema>
    const result = requestRefund(parsed)
    if (result.ok && !result.deduplicated) {
      // Fire-and-forget: notify the owner. Non-fatal if TG isn't configured.
      postRefundRequestCard(result.refund_id).catch((err) =>
        console.error('[local-mcp] postRefundRequestCard failed:', (err as Error).message),
      )
    }
    return ok(result)
  },
)

server.registerTool(
  'approve_refund',
  {
    description:
      'Owner-only. Approve a pending refund request. Updates the order status to `refunded`, attempts a Square sandbox CANCELED status update, and notifies the customer on their original channel. Idempotent — re-approving an already-approved refund is a no-op.',
    inputSchema: { refund_id: z.string(), note: z.string().optional() },
  },
  async (args) => {
    const { refund_id, note } = args as { refund_id: string; note?: string }
    const result = await approveRefund(refund_id, note)
    return ok(result)
  },
)

server.registerTool(
  'deny_refund',
  {
    description:
      'Owner-only. Deny a pending refund request. Requires a customer-facing reason (≥ 3 chars) — it will be sent verbatim back on the original channel after a brand-voice intro. Reverts the order to its prior status (so kitchen flow continues if applicable). Idempotent.',
    inputSchema: { refund_id: z.string(), reason: z.string() },
  },
  async (args) => {
    const { refund_id, reason } = args as { refund_id: string; reason: string }
    const result = await denyRefund(refund_id, reason)
    return ok(result)
  },
)

server.registerTool(
  'list_refunds',
  {
    description:
      'Owner-only. List recent refund requests. Filter by status (pending/approved/denied). Useful for /refunds slash command and the owner agent reasoning about open refund work.',
    inputSchema: {
      status: z.enum(['pending', 'approved', 'denied']).optional(),
      limit: z.number().int().positive().optional(),
    },
  },
  async (args) =>
    ok(listRefunds(args as { status?: 'pending' | 'approved' | 'denied'; limit?: number })),
)

server.registerTool(
  'daily_report',
  {
    description: "Owner-only. Today's order count, revenue, pending approvals, open escalations.",
    inputSchema: {},
  },
  async () => ok(dailyReport()),
)

server.registerTool(
  'queue_owner_approval',
  {
    description:
      'Marketing/concierge. Queue an item for the owner to approve before it goes out (campaign launch, IG/GBP post draft, budget change, sensitive customer reply). Persists to the cockpit\'s /admin/posts queue.',
    inputSchema: {
      kind: z.enum(['campaign', 'creative', 'budget_change', 'reply']),
      summary: z.string(),
      detail: z.string(),
      channel: z.enum(['instagram', 'whatsapp', 'gbp', 'web', 'telegram']).optional(),
    },
  },
  async (args) => {
    const { kind, summary, detail, channel } = args as {
      kind: 'campaign' | 'creative' | 'budget_change' | 'reply'
      summary: string
      detail: string
      channel?: 'instagram' | 'whatsapp' | 'gbp' | 'web' | 'telegram'
    }
    const approval = createApproval({ kind, summary, detail, channel: channel ?? null })
    return ok({ ok: true, approval_id: approval.id, kind, summary, detail, channel: approval.channel })
  },
)

// ─── Brand RAG ───────────────────────────────────────────────────────────
// Cheap, offline, deterministic lookup against docs/agent-context/brand-rules.md
// (a public-safe distillation of the gitignored canonical BRANDBOOK), so
// agents that don't carry the full brand voice in their system prompt
// (kitchen, owner) can still quote canonical lines instead of inventing
// brand language. Sections are split on `## Heading`. Customer-facing roles
// (concierge, marketing) already have the prepended brand.md prompt; they
// can still call this tool to fetch deeper sections (e.g. "Marketing tone").

const BRANDBOOK_PATH = resolve('docs/agent-context/brand-rules.md')
let brandbookCache: { sections: Array<{ heading: string; body: string }>; loadedAt: number } | null = null

function loadBrandbook(): { sections: Array<{ heading: string; body: string }> } {
  // Cache for 60s — the file rarely changes, but we don't want stale prompts
  // if a build edit lands.
  if (brandbookCache && Date.now() - brandbookCache.loadedAt < 60_000) {
    return brandbookCache
  }
  if (!existsSync(BRANDBOOK_PATH)) {
    return { sections: [] }
  }
  const text = readFileSync(BRANDBOOK_PATH, 'utf8')
  const sections: Array<{ heading: string; body: string }> = []
  const lines = text.split('\n')
  let current: { heading: string; lines: string[] } | null = null
  for (const line of lines) {
    const m = /^##\s+(.+?)\s*$/.exec(line)
    if (m) {
      if (current) sections.push({ heading: current.heading, body: current.lines.join('\n').trim() })
      current = { heading: m[1], lines: [] }
    } else if (current) {
      current.lines.push(line)
    }
  }
  if (current) sections.push({ heading: current.heading, body: current.lines.join('\n').trim() })
  brandbookCache = { sections, loadedAt: Date.now() }
  return { sections }
}

server.registerTool(
  'brand_lookup',
  {
    description:
      'Look up canonical brand voice / identity rules. Pass `query` for keyword search across brand-rules.md sections, or `section` for an exact heading match. Use this whenever the agent needs to quote brand voice, signature phrases, allowed/forbidden words, or product copy without inventing.',
    inputSchema: {
      query: z.string().optional(),
      section: z.string().optional(),
      max_chars: z.number().int().positive().optional(),
    },
  },
  async (args) => {
    const { query, section, max_chars } = args as { query?: string; section?: string; max_chars?: number }
    const cap = max_chars ?? 2000
    const { sections } = loadBrandbook()
    if (!sections.length) return ok({ ok: false, reason: 'brand-rules.md not found' })

    if (section) {
      const exact = sections.find((s) => s.heading.toLowerCase() === section.toLowerCase())
      if (!exact) return ok({ ok: false, reason: `no section "${section}"`, available: sections.map((s) => s.heading) })
      return ok({ ok: true, heading: exact.heading, body: exact.body.slice(0, cap) })
    }

    if (query) {
      const q = query.toLowerCase()
      const matches = sections
        .map((s) => ({
          heading: s.heading,
          body: s.body,
          score:
            (s.heading.toLowerCase().includes(q) ? 5 : 0) +
            (s.body.toLowerCase().split(q).length - 1),
        }))
        .filter((m) => m.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
      if (!matches.length) return ok({ ok: false, reason: `no match for "${query}"`, available: sections.map((s) => s.heading) })
      return ok({
        ok: true,
        matches: matches.map((m) => ({ heading: m.heading, body: m.body.slice(0, cap) })),
      })
    }

    // No query / section: return the section index so the agent can pick.
    return ok({ ok: true, sections: sections.map((s) => s.heading) })
  },
)

server.registerTool(
  'notify_customer',
  {
    description:
      'Kitchen-only. Send a notification to the customer who placed the order (e.g. "your cake is ready"). The wrapper resolves which channel to use.',
    inputSchema: { order_id: z.string(), text: z.string() },
  },
  async (args) => {
    const { order_id, text } = args as { order_id: string; text: string }
    // Delegated to the channel layer at the server level — we only mark intent here.
    return ok({ ok: true, queued: true, order_id, text })
  },
)


server.registerTool(
  'get_policies',
  {
    description:
      "HappyCake's customer-facing policies. Authoritative source for: shipping (we don't), pickup, local delivery, allergens (shared kitchen), hours, cancellation, payment methods, contact channels. Call this BEFORE answering any 'do you...?' / 'what time...?' / 'how do I...?' question. Note: lead times and capacity are NOT here \u2014 those come from kitchen_get_menu_constraints + kitchen_get_capacity (live MCP). Some fields carry _confidence: 'placeholder' \u2014 escalate to owner rather than quote those as fact.",
    inputSchema: {},
  },
  async () => ok(getPolicies()),
)

server.registerTool(
  'brand_lookup',
  {
    description:
      'Brand-RAG over docs/agent-context/brand-rules.md. Use this when you need canonical brand voice, naming conventions, taglines, halal/kosher policy, logo guidance, or any other brand rule \u2014 instead of inventing or memorising. Returns the top-N matching sections by keyword overlap. Cheap, deterministic, no LLM call.',
    inputSchema: brandLookupSchema.shape,
  },
  async (args) => ok(brandLookup(args as z.infer<typeof brandLookupSchema>)),
)

// \u2500\u2500\u2500 CRM tools \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
//
// Three lookups against the customers table. Read-only \u2014 writes happen
// implicitly when the agent (or website checkout) creates a draft order
// via create_draft_order, which calls upsertCustomerForOrder() under
// the hood.
//
// Identity rules:
// - Threads link to a customer once we've seen a phone (createDraftOrder).
// - Phone is the strong key (E.164 normalized). Email is the fallback.
// - The agent should call find_customer_by_phone or find_customer_by_thread
//   FIRST when answering "have I ordered before?" or before quoting
//   personalized lead times \u2014 never invent customer history.

server.registerTool(
  'find_customer_by_thread',
  {
    description:
      'Look up the customer record linked to a chat thread (channel + thread_id). Returns null if the thread has no customer linked yet (the customer hasn\'t given a phone in this conversation). Cheapest path inside an agent run \u2014 call this before find_customer_by_phone.',
    inputSchema: { thread_id: z.string() },
  },
  async (args) => {
    const { thread_id } = args as { thread_id: string }
    const c = findCustomerByThread(thread_id)
    return ok(c ?? { ok: false, reason: 'no customer linked to this thread' })
  },
)

server.registerTool(
  'find_customer_by_phone',
  {
    description:
      'Look up a customer by phone number. Phone is normalized to E.164 internally \u2014 pass any format (\"(281) 979-8320\", \"+1 281\u2026\", \"2819798320\"). Returns the customer record if found, or {ok:false, reason} if not. Use when a caller gives their number on the phone or in chat.',
    inputSchema: { phone: z.string() },
  },
  async (args) => {
    const { phone } = args as { phone: string }
    const norm = normalizePhone(phone)
    if (!norm) return ok({ ok: false, reason: 'invalid phone' })
    const c = findCustomerByPhone(norm)
    return ok(c ?? { ok: false, reason: `no customer found for ${norm}` })
  },
)

server.registerTool(
  'list_customer_orders',
  {
    description:
      'List a customer\'s recent orders (most recent first), with status, total, and an item summary. Pass customer_id (from find_customer_by_*) and an optional limit (default 5). Use to answer \"what did they order last time?\" or to check order history before promising a delivery time.',
    inputSchema: { customer_id: z.string(), limit: z.number().int().positive().max(50).optional() },
  },
  async (args) => {
    const { customer_id, limit } = args as { customer_id: string; limit?: number }
    const customer = getCustomerById(customer_id)
    if (!customer) return ok({ ok: false, reason: `unknown customer ${customer_id}` })
    return ok({
      ok: true,
      customer_id,
      name: customer.name,
      phone: customer.phone,
      order_count: customer.order_count,
      total_spent_cents: customer.total_spent_cents,
      first_seen_at: customer.first_seen_at,
      last_seen_at: customer.last_seen_at,
      recent_orders: listCustomerOrders(customer_id, limit ?? 5),
    })
  },
)

server.registerTool(
  'merge_customers',
  {
    description:
      'Owner-only. Merge a duplicate customer record. SOURCE merges into TARGET — target survives, source is deleted, all orders/threads re-pointed at target, counters summed, missing fields filled. Use when two customer records exist for the same person (typically because phone was missing on one). Returns counts of moved rows, or {ok:false} with a reason if phone numbers conflict.',
    inputSchema: { source_customer_id: z.string(), target_customer_id: z.string() },
  },
  async (args) => {
    const { source_customer_id, target_customer_id } = args as {
      source_customer_id: string
      target_customer_id: string
    }
    return ok(mergeCustomers(source_customer_id, target_customer_id))
  },
)

const transport = new StdioServerTransport()
await server.connect(transport)
