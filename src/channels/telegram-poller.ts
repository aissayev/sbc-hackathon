// One long-poll loop per configured Telegram bot.
// Each bot delivers messages with the right `roleHint` so the router picks the
// agent prompt without further parsing.

import type { MessageHandler } from './types.ts'
import { configuredBots, parseTelegramUpdate, type TelegramBotSpec, type TelegramUpdate } from './telegram.ts'

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
        for (const msg of parseTelegramUpdate(update, bot.role, bot.ownerChatIds)) {
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
  console.log(`[telegram] ${bots.length} poller(s) running: ${bots.map((b) => b.role).join(', ')}`)
}

export function stopTelegramPollers() {
  stopped = true
}
