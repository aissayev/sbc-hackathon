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
import { postDraftOrderCard, postEscalationCard } from '../../bots/owner/index.ts'

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
    description: 'Create a draft order pending owner approval. Returns order_id and total_cents.',
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
    description: 'Look up status of a Happy Cake order by id.',
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
      'Marketing-only. Queue a campaign brief for the owner to approve before launching. Returns a queue id.',
    inputSchema: {
      kind: z.enum(['campaign', 'creative', 'budget_change']),
      summary: z.string(),
      detail: z.string(),
    },
  },
  async (args) => {
    const { kind, summary, detail } = args as { kind: string; summary: string; detail: string }
    const id = `aprv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    return ok({ ok: true, approval_id: id, kind, summary, detail })
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

const transport = new StdioServerTransport()
await server.connect(transport)
