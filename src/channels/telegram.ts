// Multi-bot Telegram fan-out.
// One bot per role; each maps inbound to the role hint that picks the right
// agent prompt. All bots share the same outbound API surface but different
// tokens. Used by both customer-facing channels (rare on TG) and the operator
// cockpit (the main TG use case).

import type { AgentRole, ChannelAdapter, IncomingMessage } from './types.ts'
import { config } from '../config.ts'

const TG_API = 'https://api.telegram.org'

export interface TelegramBotSpec {
  role: AgentRole
  token: string
  // For owner-side bots, restrict inbound to these chat ids (defends against
  // strangers messaging the owner bot). Empty array = open mode: any chat
  // accepted. Open mode is a HACKATHON convenience — production deploys MUST
  // populate the whitelist (see config.telegram.owner.chatIds in src/config.ts).
  ownerChatIds?: string[]
}

interface SendMessageResponse {
  ok: boolean
  result?: { message_id: number }
  description?: string
}

interface InlineKeyboardButton {
  text: string
  data: string
}

async function tgRequest<T>(token: string, method: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${TG_API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json()) as { ok: boolean; description?: string } & T
  if (!data.ok) throw new Error(`Telegram ${method} failed: ${data.description ?? 'unknown'}`)
  return data as T
}

// Single TG channel adapter. Uses the OWNER bot for operator notifications by default.
export const telegramAdapter: ChannelAdapter = {
  channel: 'telegram',
  async send(threadId, text) {
    const token = config.telegram.owner.token ?? config.telegram.concierge.token
    if (!token) {
      console.warn('[telegram] no bot token configured; skipping send')
      return
    }
    await tgRequest<SendMessageResponse>(token, 'sendMessage', {
      chat_id: threadId,
      text,
    })
  },
}

export async function sendTelegram(
  token: string,
  chatId: string | number,
  text: string,
  keyboard?: InlineKeyboardButton[][],
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2',
): Promise<number | null> {
  const res = await tgRequest<SendMessageResponse>(token, 'sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: parseMode,
    reply_markup: keyboard
      ? {
          inline_keyboard: keyboard.map((row) =>
            row.map((b) => ({ text: b.text, callback_data: b.data })),
          ),
        }
      : undefined,
  })
  return res.result?.message_id ?? null
}

/**
 * Post a photo to Telegram by URL. Telegram fetches the URL server-side and
 * renders the image inline. Best-effort: returns null if upload fails or
 * the URL isn't reachable from Telegram's network.
 */
export async function sendTelegramPhoto(
  token: string,
  chatId: string | number,
  photoUrl: string,
  caption?: string,
): Promise<number | null> {
  try {
    const res = await tgRequest<SendMessageResponse>(token, 'sendPhoto', {
      chat_id: chatId,
      photo: photoUrl,
      caption,
    })
    return res.result?.message_id ?? null
  } catch (err) {
    console.warn('[telegram] sendPhoto failed:', (err as Error).message)
    return null
  }
}

/**
 * Edit a previously-sent message. Used to turn a "🤔 thinking..." placeholder
 * into the final reply once `claude -p` returns. No-throw on edit failure
 * (e.g. message too old) — caller falls back to sendMessage.
 */
export async function editTelegramMessage(
  token: string,
  chatId: string | number,
  messageId: number,
  text: string,
  keyboardOrParseMode?: InlineKeyboardButton[][] | 'HTML' | 'Markdown' | 'MarkdownV2',
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2',
): Promise<boolean> {
  // Backwards-compat: 5th arg used to be parseMode. Now it can be a keyboard
  // OR a parseMode string. Detect by type.
  const keyboard = Array.isArray(keyboardOrParseMode) ? keyboardOrParseMode : undefined
  const mode =
    typeof keyboardOrParseMode === 'string' ? keyboardOrParseMode : parseMode
  try {
    await tgRequest<SendMessageResponse>(token, 'editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: mode,
      reply_markup: keyboard
        ? {
            inline_keyboard: keyboard.map((row) =>
              row.map((b) => ({ text: b.text, callback_data: b.data })),
            ),
          }
        : undefined,
    })
    return true
  } catch {
    return false
  }
}

/**
 * Download a file from Telegram by file_id.
 *
 * Two-step: getFile returns a `file_path`, then we GET it from
 * `api.telegram.org/file/bot<TOKEN>/<file_path>`. Voice messages are .ogg
 * Opus. Telegram caps file_path at 20MB which is far beyond any voice note.
 */
export async function downloadTelegramFile(
  token: string,
  fileId: string,
): Promise<{ buffer: Uint8Array; filePath: string }> {
  const meta = await tgRequest<{ result?: { file_path?: string } }>(token, 'getFile', {
    file_id: fileId,
  })
  const filePath = meta.result?.file_path
  if (!filePath) throw new Error(`Telegram getFile returned no file_path for ${fileId}`)
  const url = `${TG_API}/file/bot${token}/${filePath}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Telegram file download ${res.status} for ${filePath}`)
  const buf = new Uint8Array(await res.arrayBuffer())
  return { buffer: buf, filePath }
}

/**
 * Show "typing..." in the operator's chat. Indicator auto-clears after ~5s
 * or when the next message arrives, so we re-emit it during long agent runs.
 */
export async function sendChatAction(
  token: string,
  chatId: string | number,
  action: 'typing' | 'upload_photo' = 'typing',
): Promise<void> {
  try {
    await tgRequest<{ ok: boolean }>(token, 'sendChatAction', { chat_id: chatId, action })
  } catch {
    // chat actions are best-effort
  }
}

interface TgUser {
  id: number
  first_name?: string
  username?: string
}

interface TgChat {
  id: number
  type: string
}

interface TgVoice {
  file_id: string
  file_unique_id: string
  duration: number
  mime_type?: string
  file_size?: number
}

interface TgAudio {
  file_id: string
  file_unique_id: string
  duration: number
  mime_type?: string
  title?: string
  performer?: string
  file_size?: number
}

interface TgMessage {
  message_id: number
  from?: TgUser
  chat: TgChat
  date: number
  text?: string
  caption?: string
  voice?: TgVoice
  audio?: TgAudio
}

interface TgCallbackQuery {
  id: string
  from: TgUser
  message?: TgMessage
  data?: string
}

export interface TelegramUpdate {
  update_id: number
  message?: TgMessage
  edited_message?: TgMessage
  callback_query?: TgCallbackQuery
}

export function parseTelegramUpdate(
  update: TelegramUpdate,
  role: AgentRole,
  ownerChatIds?: string[],
): IncomingMessage[] {
  const m = update.message ?? update.edited_message
  if (!m || typeof m.text !== 'string') return []
  // Owner-side bots only listen to whitelisted chat ids when the list is
  // populated. Empty list = open mode (HACKATHON ONLY — see TelegramBotSpec).
  if (ownerChatIds && ownerChatIds.length > 0) {
    if (!ownerChatIds.includes(String(m.chat.id))) {
      console.warn(`[telegram:${role}] ignoring message from non-owner chat ${m.chat.id}`)
      return []
    }
  }
  return [
    {
      channel: 'telegram',
      threadId: String(m.chat.id),
      senderId: String(m.from?.id ?? m.chat.id),
      senderName: m.from?.username ?? m.from?.first_name,
      text: m.text,
      timestamp: m.date * 1000,
      raw: update,
      roleHint: role,
    },
  ]
}

export function configuredBots(): TelegramBotSpec[] {
  const out: TelegramBotSpec[] = []
  // Same whitelist applies to every operator-side bot — kitchen, marketing,
  // concierge, owner. Customers don't talk to these; the team does.
  const ownerChatIds = config.telegram.owner.chatIds
  if (config.telegram.owner.token) {
    out.push({ role: 'owner', token: config.telegram.owner.token, ownerChatIds })
  }
  if (config.telegram.kitchen.token) {
    out.push({ role: 'kitchen', token: config.telegram.kitchen.token, ownerChatIds })
  }
  if (config.telegram.marketing.token) {
    out.push({ role: 'marketing', token: config.telegram.marketing.token, ownerChatIds })
  }
  if (config.telegram.concierge.token) {
    // Concierge bot is a *log* bot — not for customers; for the team to watch.
    out.push({ role: 'concierge', token: config.telegram.concierge.token, ownerChatIds })
  }
  return out
}
