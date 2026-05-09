// Hono entrypoint. Webhooks → onMessage → agent invoke → channel reply.
// Per-channel adapters live in src/channels; per-role agents live in src/agent.
//
// Hard rules: agent runtime is `claude -p` only (Claude Code CLI), Opus 4.7 pinned.

import { Hono } from 'hono'
import { resolve } from 'node:path'
import { config, configuredChannels } from './config.ts'
import { webAdapter } from './channels/web.ts'
import { whatsappAdapter } from './channels/whatsapp.ts'
import { instagramAdapter } from './channels/instagram.ts'
import { telegramAdapter, sendTelegram, configuredBots } from './channels/telegram.ts'
import { startTelegramPollers } from './channels/telegram-poller.ts'
import { invokeAgent, recordRun } from './agent/invoke.ts'
import { pickRole } from './agent/router.ts'
import { createWebhookRoutes } from './routes/webhooks.ts'
import type { IncomingMessage, MessageHandler, ChannelAdapter } from './channels/types.ts'
import {
  isOwnerSlashCommand,
  handleOwnerCommand,
  handleOwnerCallback,
  sendOwnerReply,
  sendOwnerThinking,
  finalizeOwnerThinking,
  makeOwnerStreamSink,
  logInbound,
  logOutbound,
  logError,
  logSystem,
} from './bots/owner.ts'
import { clearHistory } from './db/threads.ts'
import {
  listProducts,
  getProduct,
  createDraftOrder,
  createDraftOrderSchema,
  getOrderStatus,
  createLead,
  createLeadSchema,
} from './domain/tools.ts'
import { getPolicies } from './domain/policies.ts'
import { openApiSpec } from './web/openapi.ts'

const app = new Hono()

const adapters: Record<string, ChannelAdapter> = {
  web: webAdapter,
  whatsapp: whatsappAdapter,
  instagram: instagramAdapter,
  telegram: telegramAdapter,
}

const MCP_CONFIG = resolve('.mcp.json')

const onMessage: MessageHandler = async (msg) => {
  // Owner slash commands are DB-backed: instant, free, no `claude -p` spend.
  // Free text from the operator falls through to the agent below.
  if (isOwnerSlashCommand(msg)) {
    if (msg.text.trim().toLowerCase().startsWith('/reset')) {
      clearHistory(msg.threadId)
      await sendOwnerReply(msg.threadId, { text: '✓ conversation cleared. fresh context.' })
      return
    }
    const reply = handleOwnerCommand(msg)
    if (reply) {
      await sendOwnerReply(msg.threadId, reply)
      return
    }
  }

  const role = pickRole(msg)
  const t0 = Date.now()
  console.log(`[${msg.channel}] ${msg.threadId} → ${role}: "${msg.text.slice(0, 80)}"`)

  // Mirror customer-channel inbound to the owner's TG log so Askhat (and the
  // evaluator) sees every message land. Skip when the owner IS the source
  // (free-text owner-cockpit turns shouldn't echo themselves).
  if (role !== 'owner') {
    logInbound(msg.channel, msg.threadId, role, msg.text)
  }

  // Owner free text gets a "thinking…" placeholder that we live-edit as
  // claude -p emits stream-json events. Each tool call and assistant text
  // block updates the same TG message in place — "Streaming Text for Bots"
  // UX over the existing editMessageText API. Throttled to ≤ 1/800ms.
  const thinkingMsgId = role === 'owner' ? await sendOwnerThinking(msg.threadId) : null
  const onStream = role === 'owner' ? makeOwnerStreamSink(msg.threadId, thinkingMsgId) : undefined

  try {
    const run = await invokeAgent({ role, msg, mcpConfigPath: MCP_CONFIG, onStream })
    recordRun(msg.threadId, run)
    if (role === 'owner' && thinkingMsgId !== null) {
      await finalizeOwnerThinking(msg.threadId, thinkingMsgId, run)
    } else {
      const adapter = adapters[msg.channel]
      if (run.reply && adapter) {
        await adapter.send(msg.threadId, run.reply)
      }
      // Customer-channel reply landed — log a one-liner to the owner.
      logOutbound(msg.channel, msg.threadId, run.tool_calls.length, run.duration_ms, run.cost_usd)
    }
    console.log(
      `[${msg.channel}] ${msg.threadId} ← role=${role} ${run.tool_calls.length} tools, ${run.duration_ms}ms, $${run.cost_usd ?? '?'} (exit ${run.exit_code})`,
    )
  } catch (err) {
    const errMsg = (err as Error).message
    console.error(`[${msg.channel}] ${msg.threadId} agent error:`, errMsg)
    logError(msg.channel, msg.threadId, `agent error: ${errMsg}`)
    if (role === 'owner' && thinkingMsgId !== null) {
      await finalizeOwnerThinking(msg.threadId, thinkingMsgId, {
        reply: "Sorry — something hiccupped. I'm logging it.",
        tool_calls: [],
        duration_ms: 0,
        cost_usd: null,
        exit_code: -1,
      })
    } else {
      const adapter = adapters[msg.channel]
      if (adapter) {
        await adapter.send(msg.threadId, "Sorry — something hiccupped on our side. I'm escalating to a person.")
      }
    }
  }
  console.log(`[${msg.channel}] ${msg.threadId} total ${Date.now() - t0}ms`)
}

// ─── Health + introspection ──────────────────────────────────────────────

app.get('/', (c) =>
  c.json({
    name: 'happycake-agents',
    version: '0.1.0',
    channels: configuredChannels(),
    agent: { enabled: config.agent.enabled, model: config.agent.model },
    sandbox_mcp: config.sandbox.mcpUrl,
  }),
)

// The public website now lives in web/ (Next.js, see web/src/app/*). The
// backend serves only API + agent surfaces; nginx routes / to the Next.js
// process and /api/* to here.

// ─── Public catalog API (Agent-Friendliness) ─────────────────────────────

app.get('/api/products', (c) => c.json({ products: listProducts({ in_stock_only: true }) }))
app.get('/api/products/:id', (c) => {
  const p = getProduct(c.req.param('id'))
  return p ? c.json(p) : c.json({ error: 'not found' }, 404)
})
app.get('/openapi.json', (c) => c.json(openApiSpec()))
app.get('/api/policies', (c) => c.json(getPolicies()))

// ─── Orders API (customer-side direct order flow) ────────────────────────

app.post('/api/orders/draft', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid json' }, 400)
  }
  const parsed = createDraftOrderSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'validation failed', issues: parsed.error.issues }, 400)
  }
  const result = createDraftOrder(parsed.data)
  if (!result.ok) {
    return c.json(result, 400)
  }
  // Status is `draft`. The owner approves via Telegram or admin UI; that flow
  // promotes to sandbox `square_create_order` + `kitchen_create_ticket`.
  return c.json({
    order_id: result.order_id,
    total_cents: result.total_cents,
    status: result.status,
    items: result.items,
    next_step: 'awaiting_owner_approval',
  })
})

app.get('/api/orders/:id', (c) => {
  const id = c.req.param('id')
  const status = getOrderStatus({ order_id: id }) as Record<string, unknown>
  if (status && 'ok' in status && status.ok === false) {
    return c.json(status, 404)
  }
  return c.json(status)
})

// ─── Leads (B2B + custom-cake funnels) ───────────────────────────────────
//
// Multi-step funnels on the website (web/src/components/business/inquire-form,
// web/src/components/order/custom-cake-funnel) submit here. We capture the
// freeform context as `meta_json` so the owner-side TG bot can render it as a
// review card without us needing a per-source schema.

app.post('/api/leads/:source', async (c) => {
  const source = c.req.param('source')
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid json' }, 400)
  }
  const parsed = createLeadSchema.safeParse({ ...(body as Record<string, unknown>), source })
  if (!parsed.success) {
    return c.json({ error: 'validation failed', issues: parsed.error.issues }, 400)
  }
  const result = createLead(parsed.data)
  return c.json({ ...result, next_step: 'awaiting_owner_review' })
})

app.get('/llms.txt', (c) =>
  c.text(`# HappyCake — agent-readable surface

HappyCake is a real bakery in Sugar Land, TX. AI agents are welcome to use this site directly via JSON.

## Endpoints
- GET /api/products             List in-stock products
- GET /api/products/{id}        Product detail
- POST /api/orders/draft        Create a draft order (returns order_id; queued for owner approval)
- GET /api/orders/{id}          Order status (public, by id)
- POST /api/leads/{source}      Capture a B2B / custom-cake / newsletter / press lead (queued for owner review)
- POST /api/chat                Talk to the on-site assistant; returns thread_id + replies[]
- GET /openapi.json             Full API spec
- GET /menu                     Human-readable catalog (HTML, with Schema.org Product JSON-LD per product)

## Conventions
- Prices are USD cents (e.g. 850 = $8.50)
- Times are ISO 8601
- /api/chat maintains conversation history via thread_id

## Order intent flow
1. GET /api/products  — find a product id
2. POST /api/chat with text describing what + when — agent will check kitchen capacity, draft an order, and queue for owner approval.
`),
)

// ─── /test/incoming — eval surface ───────────────────────────────────────
// Accepts an IncomingMessage shape and returns reply + tool-call trace.

app.post('/test/incoming', async (c) => {
  const body = (await c.req.json()) as Partial<IncomingMessage>
  if (!body.text || !body.threadId) return c.json({ error: 'text, threadId required' }, 400)
  const msg: IncomingMessage = {
    channel: body.channel ?? 'web',
    threadId: body.threadId,
    senderId: body.senderId ?? body.threadId,
    senderName: body.senderName,
    text: body.text,
    timestamp: body.timestamp ?? Date.now(),
    raw: body,
    roleHint: body.roleHint,
  }
  await onMessage(msg)
  const replies = msg.channel === 'web' ? webAdapter.drain(msg.threadId) : []
  return c.json({ thread_id: msg.threadId, replies })
})

// ─── /api/chat — public web chat (will back the on-site assistant) ───────

// ─── Channel webhooks (WA, IG) ───────────────────────────────────────────

app.route('/', createWebhookRoutes(onMessage))

app.post('/api/chat', async (c) => {
  const body = (await c.req.json()) as { thread_id?: string; text?: string; sender_name?: string }
  if (!body.text) return c.json({ error: 'text required' }, 400)
  const threadId = body.thread_id ?? `web_${Math.random().toString(36).slice(2, 10)}`
  await onMessage({
    channel: 'web',
    threadId,
    senderId: threadId,
    senderName: body.sender_name,
    text: body.text,
    timestamp: Date.now(),
    raw: body,
  })
  const replies = webAdapter.drain(threadId)
  return c.json({ thread_id: threadId, replies })
})

console.log(`[server] starting on :${config.port} channels=${configuredChannels().join(',')}`)
console.log(`[server] agent=${config.agent.enabled ? config.agent.model : 'disabled'}`)
console.log(`[server] sandbox_mcp=${config.sandbox.mcpUrl} token=${config.sandbox.teamToken ? 'set' : 'MISSING'}`)
console.log(`[server] telegram bots: ${configuredBots().map((b) => b.role).join(', ') || '(none)'}`)

// One-shot boot ping so the owner sees the server come up. Verbose-only by
// default — set TG_OWNER_LOG_LEVEL=verbose to see system events in TG.
logSystem(`server up · channels: ${configuredChannels().join(',')} · agent: ${config.agent.enabled ? config.agent.model : 'disabled'}`)

// Start one long-poll per configured TG bot. Owner-side messages with
// callback_query are handled by the inline-keyboard callback (see src/bots/owner.ts).
startTelegramPollers({
  onMessage,
  onCallback: async (bot, update) => {
    const cq = update.callback_query
    if (!cq) return
    console.log(`[telegram:${bot.role}] callback from ${cq.from.username}: data=${cq.data}`)
    // Acknowledge the tap so the spinner clears in the TG client.
    try {
      await fetch(`https://api.telegram.org/bot${bot.token}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: cq.id }),
      })
    } catch {}
    if (!cq.data || !cq.message) return
    // Owner-bot taps run deterministic orchestration (approve/reject/view_esc),
    // bypassing `claude -p`. "Press a button → cake is ordered" is not LLM-gated.
    if (bot.role === 'owner') {
      const handled = await handleOwnerCallback(
        bot.token,
        String(cq.message.chat.id),
        cq.data,
      )
      if (handled) return
    }
    // Anything we don't recognize falls through to the agent.
    await onMessage({
      channel: 'telegram',
      threadId: String(cq.message.chat.id),
      senderId: String(cq.from.id),
      senderName: cq.from.username ?? cq.from.first_name,
      text: cq.data,
      timestamp: Date.now(),
      raw: update,
      roleHint: bot.role,
    })
  },
})

void sendTelegram

export default {
  port: config.port,
  fetch: app.fetch,
}
