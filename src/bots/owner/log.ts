// Owner-facing event log.
//
// The hackathon brief: "Owner gets a useful Telegram update. System leaves
// evidence in logs/state so the evaluator can verify what happened."
//
// We post one-line event entries to the owner's TG chat for inbound messages,
// outbound replies, errors, and system state changes — separate from the
// auto-cards (drafts/escalations) which are interactive. These are read-only
// log lines that give Askhat (and the evaluator) a live tape of activity.
//
// Filter via TG_OWNER_LOG_LEVEL in .env.local:
//   - verbose  — every event including agent traces and webhook acks
//   - normal   — inbound + outbound + errors (default)
//   - quiet    — errors only
//   - off      — nothing (also implied if TG_OWNER_BOT_TOKEN is unset)

import { sendTelegram } from '../../channels/telegram.ts'
import { config } from '../../config.ts'

export type LogLevel = 'verbose' | 'normal' | 'quiet' | 'off'
export type LogCategory = 'inbound' | 'outbound' | 'error' | 'system'

function envLevel(): LogLevel {
  const v = (process.env.TG_OWNER_LOG_LEVEL ?? 'normal').toLowerCase()
  if (v === 'verbose' || v === 'normal' || v === 'quiet' || v === 'off') return v
  return 'normal'
}

function shouldEmit(category: LogCategory, level: 'always' | 'verbose'): boolean {
  const env = envLevel()
  if (env === 'off') return false
  if (env === 'quiet') return category === 'error'
  if (env === 'normal') return level === 'always'
  return true // verbose
}

/**
 * Post a one-line event to the owner's TG chat. Fire-and-forget (best-effort);
 * never throws. No-op when TG_OWNER_BOT_TOKEN/CHAT_ID aren't configured.
 *
 * `level` controls whether the entry is suppressed at log levels below verbose:
 *   - 'always'  — always emitted (unless env says off/quiet+non-error)
 *   - 'verbose' — only emitted when TG_OWNER_LOG_LEVEL=verbose
 */
export async function logToOwner(
  category: LogCategory,
  summary: string,
  level: 'always' | 'verbose' = 'always',
): Promise<void> {
  if (!shouldEmit(category, level)) return
  const token = config.telegram.owner.token
  const chatId = config.telegram.owner.chatId
  if (!token || !chatId) return
  try {
    await sendTelegram(token, chatId, summary)
  } catch (err) {
    // The log itself failed — drop to console so we still see something.
    console.error('[owner-log] sendTelegram failed:', (err as Error).message)
  }
}

// ─── formatters: keep call-sites terse ──────────────────────────────────

function truncate(s: string, n = 60): string {
  return s.length > n ? `${s.slice(0, n).trimEnd()}…` : s
}

function shortChannel(channel: string): string {
  return ({ whatsapp: 'wa', instagram: 'ig', web: 'web', telegram: 'tg' } as Record<string, string>)[channel] ?? channel
}

function shortThread(threadId: string): string {
  return threadId.length > 14 ? `${threadId.slice(0, 14)}…` : threadId
}

/**
 * `📨 [wa] +12815559001 → concierge: "do you have honey today?"`
 */
export function logInbound(channel: string, threadId: string, role: string, text: string): void {
  void logToOwner('inbound', `📨 [${shortChannel(channel)}] ${shortThread(threadId)} → ${role}: "${truncate(text)}"`)
}

/**
 * `✓ [wa] +12815559001 ← 2 tools · 12.3s · $0.18`
 */
export function logOutbound(
  channel: string,
  threadId: string,
  toolCount: number,
  durationMs: number,
  costUsd: number | null,
): void {
  const cost = costUsd != null ? `$${costUsd.toFixed(2)}` : '—'
  const seconds = (durationMs / 1000).toFixed(1)
  void logToOwner('outbound', `✓ [${shortChannel(channel)}] ${shortThread(threadId)} ← ${toolCount} tools · ${seconds}s · ${cost}`)
}

/**
 * `⚠ [wa] +12815559001 agent error: timeout after 90s`
 */
export function logError(channel: string, threadId: string, message: string): void {
  void logToOwner('error', `⚠ [${shortChannel(channel)}] ${shortThread(threadId)} ${truncate(message, 100)}`)
}

/**
 * For ad-hoc system events: webhook registration, server boot, scheduled
 * runs (marketing batch, world tick). Verbose-only by default.
 */
export function logSystem(summary: string, level: 'always' | 'verbose' = 'verbose'): void {
  void logToOwner('system', `🔧 ${summary}`, level)
}
