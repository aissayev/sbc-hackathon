// Authentication for /api/admin/* — closes the open-access caveat once the
// owner has either deployment in place. Two trust paths:
//
//   1. Server-to-server (Next.js SSR → Hono backend): a shared secret in the
//      `X-Backend-Secret` header. Used by web/src/lib/api.ts for SSR reads of
//      /admin/today, /admin/orders, /admin/escalations.
//
//   2. Telegram Mini App (browser launched from the owner bot's menu button):
//      the Mini App's `Telegram.WebApp.initData` query string in the
//      `X-Telegram-Init-Data` header, HMAC-verified against the owner bot's
//      token. Optional whitelist gate via TG_OWNER_CHAT_IDS — if any chat ids
//      are configured, only those Telegram users authenticate.
//
// Open mode (hackathon default): if neither WEB_BACKEND_SECRET nor
// TG_OWNER_BOT_TOKEN is set, the middleware passes through. The boot warning
// in src/server.ts surfaces this so it can't ship to production by accident.

import type { Context, Next } from 'hono'
import { config } from '../config.ts'
import { verifyTelegramInitData, type TelegramInitDataUser } from '../lib/telegram-initdata.ts'

export type AdminActor =
  | { kind: 'open' }
  | { kind: 'server' }
  | { kind: 'tg'; user?: TelegramInitDataUser }

// Log the "open admin" warning at most once per process. Same pattern as the
// webhook handler's "no app secret" warning — visible in logs, not noisy.
let openModeWarned = false
function warnOpenMode() {
  if (openModeWarned) return
  openModeWarned = true
  console.warn(
    '[admin] OPEN MODE — /api/admin/* is unauthenticated. Set WEB_BACKEND_SECRET (server→server) or TG_OWNER_BOT_TOKEN (Mini App) to lock down.',
  )
}

export async function adminAuth(c: Context, next: Next) {
  const backendSecret = config.web.backendSecret
  const ownerToken = config.telegram.owner.token
  const requiresAuth = Boolean(backendSecret) || Boolean(ownerToken)

  if (!requiresAuth) {
    warnOpenMode()
    c.set('admin', { kind: 'open' } satisfies AdminActor)
    return next()
  }

  // Path 1: shared secret (Next.js SSR).
  if (backendSecret) {
    const provided = c.req.header('x-backend-secret')
    if (provided && provided === backendSecret) {
      c.set('admin', { kind: 'server' } satisfies AdminActor)
      return next()
    }
  }

  // Path 2: Mini App init-data.
  if (ownerToken) {
    const initData = c.req.header('x-telegram-init-data')
    if (initData) {
      const v = verifyTelegramInitData(initData, ownerToken)
      if (v.ok) {
        const whitelist = config.telegram.owner.chatIds
        if (whitelist.length > 0) {
          const userId = v.user?.id
          if (!userId || !whitelist.includes(String(userId))) {
            return c.json({ error: 'not_an_owner' }, 403)
          }
        }
        c.set('admin', { kind: 'tg', user: v.user } satisfies AdminActor)
        return next()
      }
      // Bad signature / expired init-data — surface the reason in logs once
      // per actor for debug visibility, but return a generic 401 to callers.
      console.warn(`[admin] init-data rejected: ${v.reason}`)
    }
  }

  return c.json({ error: 'auth_required' }, 401)
}
