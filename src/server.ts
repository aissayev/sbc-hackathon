// Hono entrypoint. Composition root: wire route groups, define onMessage,
// boot pollers + catalog sync. Per-route handlers live in src/routes/*.
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
import { catalogRoutes } from './routes/catalog.ts'
import { orderRoutes } from './routes/orders.ts'
import { adminRoutes } from './routes/admin.ts'
import { leadRoutes } from './routes/leads.ts'
import { uploadRoutes } from './routes/uploads.ts'
import { metaRoutes } from './routes/meta.ts'
import { createTestRoutes } from './routes/test.ts'
import type { MessageHandler, ChannelAdapter } from './channels/types.ts'
import {
  isOwnerSlashCommand,
  handleOwnerCommand,
  handleOwnerAsyncCommand,
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
import { startCatalogSync } from './domain/catalog-sync.ts'

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
    const asyncReply = await handleOwnerAsyncCommand(msg)
    if (asyncReply) {
      await sendOwnerReply(msg.threadId, asyncReply)
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

// ─── Route mounting ──────────────────────────────────────────────────────
// Public surfaces and webhooks first; admin + test surfaces last so the
// "open access" routes are easy to spot. Order doesn't matter to Hono — this
// is for human readers.

app.route('/', metaRoutes)
app.route('/', catalogRoutes)
app.route('/', orderRoutes)
app.route('/', leadRoutes)
app.route('/', uploadRoutes)
app.route('/', adminRoutes)
app.route('/', createWebhookRoutes(onMessage))
app.route('/', createTestRoutes(onMessage))

// ─── Boot ────────────────────────────────────────────────────────────────

console.log(`[server] starting on :${config.port} channels=${configuredChannels().join(',')}`)
console.log(`[server] agent=${config.agent.enabled ? config.agent.model : 'disabled'}`)
console.log(`[server] sandbox_mcp=${config.sandbox.mcpUrl} token=${config.sandbox.teamToken ? 'set' : 'MISSING'}`)
console.log(`[server] telegram bots: ${configuredBots().map((b) => b.role).join(', ') || '(none)'}`)

// Multi-owner whitelist visibility. Open mode is intentional during the
// hackathon (so we can collect team chat ids by having them message the bot
// and reading the logs) but it MUST be closed before any public deploy —
// the warning below is the single signal we surface for that.
const ownerWhitelist = config.telegram.owner.chatIds
if (config.telegram.owner.token) {
  if (ownerWhitelist.length === 0) {
    console.warn('[server] ⚠️  TG OWNER WHITELIST: OPEN MODE — any chat may interact with the owner bot')
    console.warn('[server]    Set TG_OWNER_CHAT_IDS=chatA,chatB,... before production deploy.')
  } else {
    console.log(`[server] telegram owner whitelist: ${ownerWhitelist.length} chat id(s)`)
  }
}

// Catalog sync runs only when we have a sandbox token; without it the call
// would fail every tick and pollute logs. The website still renders from the
// seeded SQLite mirror in that case.
if (config.sandbox.teamToken && config.catalog.syncIntervalMs > 0) {
  startCatalogSync(config.catalog.syncIntervalMs)
  console.log(`[server] catalog sync: every ${config.catalog.syncIntervalMs}ms`)
} else {
  console.log('[server] catalog sync: disabled (no token or interval=0)')
}

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
