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
  updateOrderStatus,
  listOrders,
  listEscalations,
  dailyReport,
} from '../../domain/tools.ts'
import { postDraftOrderCard, postEscalationCard } from '../../bots/owner.ts'

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
    description: 'Owner-only. Mark a draft order as approved so the kitchen agent can pick it up.',
    inputSchema: { order_id: z.string(), note: z.string().optional() },
  },
  async (args) => {
    const { order_id, note } = args as { order_id: string; note?: string }
    return ok(updateOrderStatus(order_id, 'approved', note))
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
    return ok(updateOrderStatus(order_id, 'rejected', reason))
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

const transport = new StdioServerTransport()
await server.connect(transport)
