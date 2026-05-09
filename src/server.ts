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
import { listProducts, getProduct } from './domain/tools.ts'
import { home, menu, productDetail, policies, chat, openApiSpec } from './web/pages.ts'

const app = new Hono()

const adapters: Record<string, ChannelAdapter> = {
  web: webAdapter,
  whatsapp: whatsappAdapter,
  instagram: instagramAdapter,
  telegram: telegramAdapter,
}

const MCP_CONFIG = resolve('.mcp.json')

const onMessage: MessageHandler = async (msg) => {
  const role = pickRole(msg)
  const t0 = Date.now()
  console.log(`[${msg.channel}] ${msg.threadId} → ${role}: "${msg.text.slice(0, 80)}"`)
  try {
    const run = await invokeAgent({ role, msg, mcpConfigPath: MCP_CONFIG })
    recordRun(msg.threadId, run)
    const adapter = adapters[msg.channel]
    if (run.reply && adapter) {
      await adapter.send(msg.threadId, run.reply)
    }
    console.log(
      `[${msg.channel}] ${msg.threadId} ← role=${role} ${run.tool_calls.length} tools, ${run.duration_ms}ms, $${run.cost_usd ?? '?'} (exit ${run.exit_code})`,
    )
  } catch (err) {
    console.error(`[${msg.channel}] ${msg.threadId} agent error:`, (err as Error).message)
    const adapter = adapters[msg.channel]
    if (adapter) {
      await adapter.send(msg.threadId, "Sorry — something hiccupped on our side. I'm escalating to a person.")
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

// ─── Public website (server-rendered HTML) ──────────────────────────────

app.get('/', (c) => c.html(home()))
app.get('/menu', (c) => c.html(menu(listProducts({ in_stock_only: true }))))
app.get('/menu/:id', (c) => {
  const p = getProduct(c.req.param('id'))
  return p ? c.html(productDetail(p)) : c.notFound()
})
app.get('/policies', (c) => c.html(policies()))
app.get('/chat', (c) => c.html(chat()))

// ─── Public catalog API (Agent-Friendliness) ─────────────────────────────

app.get('/api/products', (c) => c.json({ products: listProducts({ in_stock_only: true }) }))
app.get('/api/products/:id', (c) => {
  const p = getProduct(c.req.param('id'))
  return p ? c.json(p) : c.json({ error: 'not found' }, 404)
})
app.get('/openapi.json', (c) => c.json(openApiSpec()))
app.get('/llms.txt', (c) =>
  c.text(`# HappyCake — agent-readable surface

HappyCake is a real bakery in Sugar Land, TX. AI agents are welcome to use this site directly via JSON.

## Endpoints
- GET /api/products             List in-stock products
- GET /api/products/{id}        Product detail
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
    if (cq.data && cq.message) {
      // Forward the action to the agent as if the operator typed it.
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
    }
  },
})

void sendTelegram

export default {
  port: config.port,
  fetch: app.fetch,
}
