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

import { sendTelegram, sendTelegramPhoto } from '../../channels/telegram.ts'
import { config } from '../../config.ts'

// Match URLs the website's /api/uploads emits inside the inbound text:
//   [Photo from customer: https://hc-uploads.nyc3.cdn.digitaloceanspaces.com/uploads/threads/.../x.jpg (filename.jpg)]
// We only forward URLs hosted on the configured uploads CDN so we never
// re-host arbitrary attacker URLs in the owner chat.
const PHOTO_LINE_RE = /\[Photo from customer: (https?:\/\/[^\s)]+) \(([^)]+)\)\]/g

function isAllowedUploadHost(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
    // DigitalOcean Spaces (current upload backend) and any host explicitly
    // listed in TG_PHOTO_FORWARD_HOSTS (comma-separated) are allowed.
    if (u.hostname.endsWith('.digitaloceanspaces.com')) return true
    if (u.hostname.endsWith('.cdn.digitaloceanspaces.com')) return true
    const allow = (process.env.TG_PHOTO_FORWARD_HOSTS ?? '')
      .split(',').map((s) => s.trim()).filter(Boolean)
    return allow.includes(u.hostname)
  } catch {
    return false
  }
}

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
 *
 * If the message body contains `[Photo from customer: <url> (<name>)]` markers
 * (emitted by the website chat after a successful /api/uploads), also forward
 * each photo to the owner chat as an inline image so Askhat can see it without
 * leaving Telegram.
 */
export function logInbound(channel: string, threadId: string, role: string, text: string): void {
  void logToOwner('inbound', `📨 [${shortChannel(channel)}] ${shortThread(threadId)} → ${role}: "${truncate(text)}"`)
  void forwardPhotos(channel, threadId, text)
}

async function forwardPhotos(channel: string, threadId: string, text: string): Promise<void> {
  const token = config.telegram.owner.token
  const chatId = config.telegram.owner.chatId
  if (!token || !chatId) return
  PHOTO_LINE_RE.lastIndex = 0
  for (let m = PHOTO_LINE_RE.exec(text); m; m = PHOTO_LINE_RE.exec(text)) {
    const url = m[1]
    const name = m[2]
    if (!isAllowedUploadHost(url)) continue
    const caption = `📷 [${shortChannel(channel)}] ${shortThread(threadId)} — ${truncate(name, 40)}`
    await sendTelegramPhoto(token, chatId, url, caption)
  }
}

/**
 * `✓ [wa] +12815559001 ← 2 tools · 12.3s · $0.18`
 *
 * If `replyText` is provided, also emit a second line with the truncated reply
 * body so Askhat can see WHAT the agent said without opening the admin inbox.
 *   `🤖 [wa] +12815559001: "Yes — cake \"Honey\", $42 the whole, $8.50 a slice…"`
 */
export function logOutbound(
  channel: string,
  threadId: string,
  toolCount: number,
  durationMs: number,
  costUsd: number | null,
  replyText?: string,
): void {
  const cost = costUsd != null ? `$${costUsd.toFixed(2)}` : '—'
  const seconds = (durationMs / 1000).toFixed(1)
  void logToOwner('outbound', `✓ [${shortChannel(channel)}] ${shortThread(threadId)} ← ${toolCount} tools · ${seconds}s · ${cost}`)
  if (replyText && replyText.trim().length > 0) {
    void logToOwner('outbound', `🤖 [${shortChannel(channel)}] ${shortThread(threadId)}: "${truncate(replyText, 220)}"`)
  }
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

/**
 * `🎙 [tg] 12345…→ owner (russian, 4.2s, 1840ms): "Привет, как дела"`
 *
 * Logged in addition to the regular `logInbound` line so the owner has an
 * audit trail of WHAT was heard from voice notes (Whisper isn't perfect,
 * especially with accents — seeing the transcript in the log lets the owner
 * spot misrecognitions).
 *
 * `transformedTo` is set when we mapped a spoken keyword to a slash command
 * (e.g. transcript "brief" → command `/brief`). Helps debug the voice
 * shortcut layer.
 */
export function logVoiceTranscription(args: {
  role: string
  threadId: string
  transcript: string
  languageCode?: string
  durationSec?: number
  latencyMs: number
  transformedTo?: string
}): void {
  const lang = args.languageCode ?? 'auto'
  const dur = args.durationSec != null ? `${args.durationSec.toFixed(1)}s` : '?s'
  const head = `🎙 [tg] ${shortThread(args.threadId)} → ${args.role} (${lang}, ${dur}, ${args.latencyMs}ms)`
  const body = args.transformedTo
    ? `: "${truncate(args.transcript, 80)}" → ${args.transformedTo}`
    : `: "${truncate(args.transcript, 80)}"`
  void logToOwner('inbound', `${head}${body}`)
  // Console-side: full transcript (no truncation) so it's recoverable from
  // the server logs even if the TG channel rolls.
  console.log(
    `[voice] role=${args.role} thread=${args.threadId} lang=${lang} dur=${dur} latency=${args.latencyMs}ms${
      args.transformedTo ? ` cmd=${args.transformedTo}` : ''
    } text="${args.transcript.replace(/\n/g, ' ')}"`,
  )
}
