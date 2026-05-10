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
  parseTelegramUpdate,
  sendTelegram,
  type TelegramBotSpec,
  type TelegramUpdate,
} from './telegram.ts'
import {
  isTranscribeConfigured,
  transcribeAudio,
  TranscribeNotConfiguredError,
} from '../lib/transcribe.ts'

const TG_API = 'https://api.telegram.org'

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

  if (!isTranscribeConfigured()) {
    console.warn(`[telegram:${bot.role}] voice received but ELEVENLABS_API_KEY not set; replying gracefully`)
    await sendTelegram(
      bot.token,
      m.chat.id,
      'voice transcription is not configured on this bot — please type your message instead.',
    ).catch(() => {})
    return null
  }

  const start = Date.now()
  try {
    const { buffer } = await downloadTelegramFile(bot.token, audio.file_id)
    const result = await transcribeAudio(buffer, {
      mimeType: audio.mime_type ?? 'audio/ogg',
      filename: m.voice ? 'voice.ogg' : 'audio.ogg',
    })
    const ms = Date.now() - start
    console.log(
      `[telegram:${bot.role}] transcribed ${audio.duration}s voice in ${ms}ms (lang=${result.languageCode ?? 'auto'}): ${result.text.slice(0, 80)}${result.text.length > 80 ? '…' : ''}`,
    )

    if (!result.text) {
      await sendTelegram(
        bot.token,
        m.chat.id,
        'i could not hear anything in that voice note — try again or type the message?',
      ).catch(() => {})
      return null
    }

    // Inject the transcript so the rest of the pipeline (parser → router →
    // agent) sees a normal text message. Caption is preserved if present.
    const caption = m.caption ? `${m.caption}\n\n` : ''
    const injectedText = `${caption}${result.text}`
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
    console.error(`[telegram:${bot.role}] transcription failed:`, (err as Error).message)
    await sendTelegram(
      bot.token,
      m.chat.id,
      'something went wrong transcribing that voice note. could you type it instead?',
    ).catch(() => {})
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
          await onMessage(msg).catch((err) =>
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
  console.log(
    `[telegram] ${bots.length} poller(s) running: ${bots.map((b) => b.role).join(', ')}; voice transcription: ${isTranscribeConfigured() ? 'on (ElevenLabs)' : 'off'}`,
  )
}

export function stopTelegramPollers() {
  stopped = true
}
