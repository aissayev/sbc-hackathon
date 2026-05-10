// Live-feedback helpers for free-text owner conversations.
//
// `claude -p` against Opus 4.7 typically takes 8–15s per turn. Without
// feedback the chat looks dead. We:
//   1. Post a "🤔 thinking…" placeholder + typing indicator immediately.
//   2. Stream subsequent agent steps into that same message via throttled
//      editMessageText (≤ 1/800ms — Telegram's per-chat soft limit is 1/sec).
//   3. On done, replace with the final reply + a one-line tool/cost footer.
//
// This is the "Streaming Text for Bots" UX from Telegram's May 2026 update —
// the API is the same `editMessageText` we already use; the smoothness is the
// client's. claude -p stream-json grain is one event per assistant turn or
// tool round-trip, not per token, so we update step-by-step (which feels
// natural in chat anyway).

import { sendTelegram, editTelegramMessage, sendChatAction } from '../../channels/telegram.ts'
import { config } from '../../config.ts'
import type { StreamEvent } from '../../agent/invoke.ts'
import { mdToTelegramHtml, escapeHtml } from './format.ts'

const FRIENDLY_TOOL_NAME: Record<string, string> = {
  mcp__local__list_orders: 'list_orders',
  mcp__local__list_escalations: 'list_escalations',
  mcp__local__approve_order: 'approve_order',
  mcp__local__reject_order: 'reject_order',
  mcp__local__daily_report: 'daily_report',
  mcp__happycake__evaluator_get_evidence_summary: 'evidence_summary',
  mcp__happycake__evaluator_generate_team_report: 'team_report',
  mcp__happycake__square_get_pos_summary: 'pos_summary',
  mcp__happycake__kitchen_get_production_summary: 'kitchen_summary',
  mcp__happycake__marketing_get_campaign_metrics: 'campaign_metrics',
}

function compactTool(full: string): string {
  return FRIENDLY_TOOL_NAME[full] ?? full.replace(/^mcp__[^_]+__/, '')
}

/**
 * Post "🤔 thinking…" to the owner chat and ping the typing indicator.
 * Returns the message_id so the caller can edit it once the agent finishes,
 * or null if the owner bot isn't configured.
 */
export async function sendOwnerThinking(threadId: string): Promise<number | null> {
  const token = config.telegram.owner.token
  if (!token) return null
  void sendChatAction(token, threadId, 'typing')
  return await sendTelegram(token, threadId, '🤔 thinking…')
}

interface RunSummary {
  reply: string
  tool_calls: Array<{ name: string }>
  duration_ms: number
  cost_usd: number | null
  exit_code: number
}

/**
 * Replace the "thinking" placeholder with the agent's reply plus a one-line
 * tool/cost footer. Falls back to a fresh sendMessage if the edit fails
 * (TG rejects edits to messages older than 48h or with identical text).
 */
export async function finalizeOwnerThinking(
  threadId: string,
  thinkingMessageId: number,
  run: RunSummary,
): Promise<void> {
  const token = config.telegram.owner.token
  if (!token) return
  // Body is agent-authored markdown (`**bold**`, `*` bullets, etc.). We
  // convert to Telegram HTML so it renders properly instead of showing
  // raw asterisks. Footer is plain text we control — escape only.
  const bodyHtml = mdToTelegramHtml(run.reply || '(empty reply)')
  const toolNames = run.tool_calls.map((t) => compactTool(t.name))
  const dedup = Array.from(new Set(toolNames))
  const seconds = (run.duration_ms / 1000).toFixed(1)
  const cost = run.cost_usd != null ? `$${run.cost_usd.toFixed(2)}` : '—'
  const traceText = dedup.length
    ? `\n\n— used: ${dedup.join(', ')} · ${seconds}s · ${cost}`
    : `\n\n— ${seconds}s · ${cost}`
  const final = bodyHtml + escapeHtml(traceText)
  const edited = await editTelegramMessage(
    token,
    threadId,
    thinkingMessageId,
    final,
    'HTML',
  )
  if (!edited) {
    // Edit failed (rare — usually identical-content rejection). Send fresh.
    await sendTelegram(token, threadId, final, undefined, 'HTML')
  }
}

// ─── streaming controller ───────────────────────────────────────────────

const EDIT_THROTTLE_MS = 800 // TG soft limit: ~1 same-chat edit/sec
const TG_MAX_LEN = 4000 // Real cap is 4096; leave room for footer.

function clip(s: string, n = TG_MAX_LEN): string {
  return s.length > n ? `${s.slice(0, n)}…` : s
}

/**
 * Returns a `(StreamEvent) => void` callback bound to a TG placeholder
 * message. Throttles `editMessageText` to ≤ 1/EDIT_THROTTLE_MS, never
 * pushes identical text twice, and survives transient API failures.
 *
 * Use it together with `sendOwnerThinking` (creates the placeholder) and
 * `finalizeOwnerThinking` (writes the final reply + trace footer):
 *
 *   const msgId = await sendOwnerThinking(threadId)
 *   const stream = makeOwnerStreamSink(threadId, msgId)
 *   const run = await invokeAgent({ ..., onStream: stream })
 *   await finalizeOwnerThinking(threadId, msgId, run)
 */
export function makeOwnerStreamSink(
  threadId: string,
  messageId: number | null,
): (event: StreamEvent) => void {
  if (messageId === null) return () => {}
  const token = config.telegram.owner.token
  if (!token) return () => {}

  let lastSent = ''
  let pending: string | null = null
  let lastEditAt = 0
  let editInFlight = false
  let timer: ReturnType<typeof setTimeout> | null = null

  const tryFlush = async () => {
    if (editInFlight) return
    if (pending === null) return
    const now = Date.now()
    const wait = Math.max(0, lastEditAt + EDIT_THROTTLE_MS - now)
    if (wait > 0) {
      if (!timer) timer = setTimeout(() => {
        timer = null
        void tryFlush()
      }, wait)
      return
    }
    const text = pending
    pending = null
    if (text === lastSent) return
    editInFlight = true
    lastEditAt = Date.now()
    const ok = await editTelegramMessage(token, threadId, messageId, clip(text), 'HTML')
    editInFlight = false
    if (ok) lastSent = text
    // If new content arrived while we were sending, fire again.
    if (pending !== null) void tryFlush()
  }

  return (event) => {
    if (event.kind === 'text') {
      pending = `🤔 ${mdToTelegramHtml(event.running)}`
      void tryFlush()
    } else if (event.kind === 'tool_start') {
      // Show the tool while it runs; subsequent text events overwrite.
      const friendly = compactTool(event.name)
      const tail = lastSent && lastSent.startsWith('🤔') ? `\n\n${lastSent.slice(2).trim()}` : ''
      pending = `🛠 calling <code>${escapeHtml(friendly)}</code>…${tail}`
      void tryFlush()
    }
    // tool_end + done: no-op here; finalizeOwnerThinking writes the final state.
  }
}
