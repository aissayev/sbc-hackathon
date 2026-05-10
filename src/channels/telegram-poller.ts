// One long-poll loop per configured Telegram bot.
// Each bot delivers messages with the right `roleHint` so the router picks the
// agent prompt without further parsing.
//
// Voice support: when an inbound message is a voice note (or audio file), we
// download it via getFile, transcribe it through ElevenLabs Scribe, and then
// hand the resulting text to the rest of the pipeline as if the owner had
// typed it. Auto-detects Russian / English / Kazakh; the model handles all 3.

import type { MessageHandler } from './types.ts'
import {
  configuredBots,
  downloadTelegramFile,
  editTelegramMessage,
  parseTelegramUpdate,
  sendChatAction,
  sendTelegram,
  withTypingIndicator,
  type TelegramBotSpec,
  type TelegramUpdate,
} from './telegram.ts'
import {
  isTranscribeConfigured,
  transcribeAudio,
  TranscribeNotConfiguredError,
} from '../lib/transcribe.ts'
import { logVoiceTranscription } from '../bots/owner/log.ts'

const TG_API = 'https://api.telegram.org'

// Spoken-form keywords that map to owner slash commands. Whisper drops the
// leading slash and often capitalises / appends punctuation (e.g. "Brief.")
// so we normalise before matching. Keep this list aligned with the switch
// in src/bots/owner/commands.ts:handleOwnerCommand.
const VOICE_COMMAND_MAP: Record<string, string> = {
  // English
  brief: '/brief',
  briefing: '/brief',
  today: '/today',
  orders: '/orders',
  escalations: '/escalations',
  campaigns: '/campaigns',
  campaign: '/campaigns',
  inbox: '/inbox',
  reviews: '/reviews',
  spend: '/spend',
  score: '/score',
  reset: '/reset',
  help: '/help',
  start: '/start',
  // Russian — these are how the owner is most likely to say each command
  бриф: '/brief',
  брифинг: '/brief',
  заказы: '/orders',
  сегодня: '/today',
  кампании: '/campaigns',
  кампания: '/campaigns',
  отзывы: '/reviews',
  помощь: '/help',
  сброс: '/reset',
}

/**
 * Normalise a transcript and map spoken keywords to slash commands. Returns
 * the original text if no keyword matches. Examples:
 *   "Brief."          → "/brief"
 *   " brief "         → "/brief"
 *   "слаш бриф"       → "/brief"   (some users prefix with "slash")
 *   "show me orders"  → "show me orders"  (only exact-keyword matches)
 *
 * Single-word transcripts get matched. Multi-word transcripts only match if
 * the first non-stopword is a known command — this avoids false positives on
 * "campaigns are doing great today".
 */
export function voiceCommandToSlash(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return raw
  // Strip leading punctuation, "slash"/"слэш" prefixes, lowercase first word.
  const cleaned = trimmed.replace(/^[\s.,!?;:'"`/]+/, '')
  const words = cleaned.toLowerCase().split(/\s+/)
  // Strip trailing punctuation so "Brief." matches "brief".
  const stripPunct = (w: string) => w.replace(/[.,!?;:'"`]+$/, '')
  let head = stripPunct(words[0])
  if ((head === 'slash' || head === 'слэш' || head === 'слаш') && words.length >= 2) {
    head = stripPunct(words[1])
  }
  const match = VOICE_COMMAND_MAP[head]
  if (!match) return raw
  // Only auto-rewrite when the transcript was effectively just the command
  // (≤2 words). Longer phrases stay as free text — let the agent reason
  // about them rather than risking a false slash invocation.
  const wordCount = words.length - (head === words[0] ? 0 : 1)
  if (wordCount > 2) return raw
  return match
}

interface GetUpdatesResponse {
  ok: boolean
  result: TelegramUpdate[]
  description?: string
}

export type CallbackHandler = (bot: TelegramBotSpec, update: TelegramUpdate) => Promise<void>

let stopped = false

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * If `update` is a voice/audio message, download → transcribe → return a
 * shallow-cloned update with `message.text` populated. Otherwise returns
 * the update unchanged. On transcription failure: sends a graceful reply
 * to the chat and returns null so the caller skips the update.
 *
 * UX: the user gets immediate feedback in the chat:
 *   1. "🎙 listening…"       (sent as a placeholder, instant)
 *   2. "🎙 «what was heard»"  (edit, after Whisper returns)
 *   3. The agent's actual reply follows from the existing pipeline.
 *
 * On failure the placeholder is edited to show the error, so the user
 * never wonders if the bot is alive.
 */
async function maybeTranscribeUpdate(
  bot: TelegramBotSpec,
  update: TelegramUpdate,
): Promise<TelegramUpdate | null> {
  const m = update.message ?? update.edited_message
  if (!m) return update
  const audio = m.voice ?? m.audio
  if (!audio) return update
  // Already had text (caption + audio file) — just keep the existing text;
  // we're not running STT in that case, the user typed something.
  if (typeof m.text === 'string' && m.text.length > 0) return update

  console.log(
    `[telegram:${bot.role}] voice received: ${audio.duration}s, ${audio.file_size ?? '?'} bytes, file_id=${audio.file_id.slice(0, 16)}…`,
  )

  if (!isTranscribeConfigured()) {
    console.warn(`[telegram:${bot.role}] voice received but OPENAI_API_KEY not set; replying gracefully`)
    await sendTelegram(
      bot.token,
      m.chat.id,
      '🎙 voice transcription is not configured on this bot — please type your message instead.',
    ).catch(() => {})
    return null
  }

  // Instant feedback so the user sees the bot heard them while Whisper runs.
  // sendChatAction is best-effort (auto-clears after ~5s).
  void sendChatAction(bot.token, m.chat.id, 'typing')
  const placeholderId = await sendTelegram(bot.token, m.chat.id, '🎙 listening…').catch(() => null)

  const start = Date.now()
  try {
    const { buffer } = await downloadTelegramFile(bot.token, audio.file_id)
    const result = await transcribeAudio(buffer, {
      mimeType: audio.mime_type ?? 'audio/ogg',
      filename: m.voice ? 'voice.ogg' : 'audio.ogg',
    })
    const ms = Date.now() - start

    if (!result.text) {
      console.warn(`[telegram:${bot.role}] empty transcript for ${audio.duration}s voice`)
      const msg = '🎙 i could not hear anything in that voice note — try again or type the message?'
      if (placeholderId) {
        await editTelegramMessage(bot.token, m.chat.id, placeholderId, msg).catch(() => {})
      } else {
        await sendTelegram(bot.token, m.chat.id, msg).catch(() => {})
      }
      return null
    }

    // Map "brief" / "campaigns" / "today" → /brief etc. so voice notes can
    // invoke slash commands. Pass-through otherwise.
    const mapped = voiceCommandToSlash(result.text)
    const transformedTo = mapped !== result.text ? mapped : undefined

    // Edit the placeholder to show what was actually heard — gives the user
    // a chance to spot misrecognitions immediately.
    const heard = result.text.length > 220 ? `${result.text.slice(0, 220)}…` : result.text
    const echo = transformedTo
      ? `🎙 «${heard}» → ${transformedTo}`
      : `🎙 «${heard}»`
    if (placeholderId) {
      await editTelegramMessage(bot.token, m.chat.id, placeholderId, echo).catch(() => {})
    }

    // Internal log — both to TG owner channel (audit trail) and console
    // (recoverable from server logs). Owner role only — kitchen / marketing
    // / concierge bots fan out to the owner log too because the owner is
    // who reviews the audit trail.
    logVoiceTranscription({
      role: bot.role,
      threadId: String(m.chat.id),
      transcript: result.text,
      languageCode: result.languageCode,
      durationSec: result.durationSec ?? audio.duration,
      latencyMs: ms,
      transformedTo,
    })

    // Inject the transcript (or the mapped slash command) so the rest of
    // the pipeline (parser → router → slash dispatcher → agent) sees a
    // normal text message. Caption is preserved if present.
    const caption = m.caption ? `${m.caption}\n\n` : ''
    const injectedText = `${caption}${mapped}`
    const cloned: TelegramUpdate = {
      ...update,
      message: update.message ? { ...update.message, text: injectedText } : update.message,
      edited_message: update.edited_message
        ? { ...update.edited_message, text: injectedText }
        : update.edited_message,
    }
    return cloned
  } catch (err) {
    if (err instanceof TranscribeNotConfiguredError) {
      // Already handled above, but defensive.
      return null
    }
    const errMsg = (err as Error).message
    console.error(`[telegram:${bot.role}] transcription failed:`, errMsg)
    const userMsg = `❌ couldn't transcribe that voice note (${errMsg.slice(0, 80)}). please type it instead.`
    if (placeholderId) {
      await editTelegramMessage(bot.token, m.chat.id, placeholderId, userMsg).catch(() => {})
    } else {
      await sendTelegram(bot.token, m.chat.id, userMsg).catch(() => {})
    }
    return null
  }
}

async function pollOne(bot: TelegramBotSpec, onMessage: MessageHandler, onCallback?: CallbackHandler) {
  let offset = 0
  console.log(`[telegram:${bot.role}] long-poll starting`)
  while (!stopped) {
    try {
      const url = `${TG_API}/bot${bot.token}/getUpdates?timeout=25&offset=${offset}`
      const res = await fetch(url)
      const data = (await res.json()) as GetUpdatesResponse
      if (!data.ok) {
        console.error(`[telegram:${bot.role}] getUpdates failed:`, data.description)
        await sleep(2000)
        continue
      }
      for (const update of data.result) {
        offset = Math.max(offset, update.update_id + 1)
        if (update.callback_query && onCallback) {
          await onCallback(bot, update).catch((err) =>
            console.error(`[telegram:${bot.role}] callback err:`, (err as Error).message),
          )
          continue
        }
        const resolved = await maybeTranscribeUpdate(bot, update).catch((err) => {
          console.error(`[telegram:${bot.role}] voice pre-process err:`, (err as Error).message)
          return null
        })
        if (!resolved) continue
        for (const msg of parseTelegramUpdate(resolved, bot.role, bot.ownerChatIds)) {
          // Show "typing…" in the user's chat while the agent runs.
          // Telegram's indicator auto-clears after ~5s; the heartbeat
          // re-emits every 4s so it stays solid through long invocations.
          await withTypingIndicator(bot.token, msg.threadId, () =>
            onMessage(msg),
          ).catch((err) =>
            console.error(`[telegram:${bot.role}] onMessage err:`, (err as Error).message),
          )
        }
      }
    } catch (err) {
      console.error(`[telegram:${bot.role}] poll err:`, (err as Error).message)
      await sleep(2000)
    }
  }
}

export function startTelegramPollers(opts: { onMessage: MessageHandler; onCallback?: CallbackHandler }) {
  const bots = configuredBots()
  if (bots.length === 0) {
    console.log('[telegram] no bot tokens configured; skipping pollers')
    return
  }
  for (const b of bots) {
    void pollOne(b, opts.onMessage, opts.onCallback)
  }
  const sttStatus = isTranscribeConfigured()
    ? '✓ on (OpenAI Whisper)'
    : '✗ off — set OPENAI_API_KEY in .env.local to enable voice notes'
  console.log(
    `[telegram] ${bots.length} poller(s) running: ${bots.map((b) => b.role).join(', ')}\n[telegram] voice transcription: ${sttStatus}`,
  )
}

export function stopTelegramPollers() {
  stopped = true
}
