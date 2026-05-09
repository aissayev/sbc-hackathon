// Live-feedback helpers for free-text owner conversations.
//
// `claude -p` against Opus 4.7 typically takes 8–15s per turn. Without
// feedback the chat looks dead. We post a "🤔 thinking…" placeholder
// immediately, send a typing indicator, and edit the placeholder with the
// final reply + a one-line tool/cost trace once the agent returns. This
// makes the bot feel like Claude Code in chat: live, with trace visible.

import { sendTelegram, editTelegramMessage, sendChatAction } from '../../channels/telegram.ts'
import { config } from '../../config.ts'

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
  const body = run.reply || '(empty reply)'
  const toolNames = run.tool_calls.map((t) => compactTool(t.name))
  const dedup = Array.from(new Set(toolNames))
  const seconds = (run.duration_ms / 1000).toFixed(1)
  const cost = run.cost_usd != null ? `$${run.cost_usd.toFixed(2)}` : '—'
  const trace = dedup.length
    ? `\n\n— used: ${dedup.join(', ')} · ${seconds}s · ${cost}`
    : `\n\n— ${seconds}s · ${cost}`
  const final = body + trace
  const edited = await editTelegramMessage(token, threadId, thinkingMessageId, final)
  if (!edited) {
    // Edit failed (rare — usually identical-content rejection). Send fresh.
    await sendTelegram(token, threadId, final)
  }
}
