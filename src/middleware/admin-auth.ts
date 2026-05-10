// Authentication for /api/admin/* — three trust paths:
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
//   3. Browser session cookie (`hc_owner_session`): set after a successful
//      POST /api/auth/login or /api/auth/setup. HMAC-SHA256 signed with the
//      session_secret persisted in the auth_settings table. Cleared on
//      logout. See src/domain/auth.ts.
//
// Open mode (hackathon default): if NONE of WEB_BACKEND_SECRET,
// TG_OWNER_BOT_TOKEN, or an owner password are set, the middleware passes
// through. The boot warning in src/server.ts surfaces this so it can't
// ship to production by accident.

import type { Context, Next } from 'hono'
import { getCookie } from 'hono/cookie'
import { config } from '../config.ts'
import { verifyTelegramInitData, type TelegramInitDataUser } from '../lib/telegram-initdata.ts'
import { isOwnerPasswordSet, verifySession, SESSION_COOKIE } from '../domain/auth.ts'

export type AdminActor =
  | { kind: 'open' }
  | { kind: 'server' }
  | { kind: 'tg'; user?: TelegramInitDataUser }
  | { kind: 'session' }

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
  const passwordSet = isOwnerPasswordSet()
  const requiresAuth = Boolean(backendSecret) || Boolean(ownerToken) || passwordSet

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

  // Path 3: browser session cookie (hc_owner_session). Only consulted when
  // a password has actually been set — otherwise the cookie can't possibly
  // be valid (the session_secret is rotated on reset).
  if (passwordSet) {
    const token = getCookie(c, SESSION_COOKIE)
    if (token) {
      const v = await verifySession(token)
      if (v.ok) {
        c.set('admin', { kind: 'session' } satisfies AdminActor)
        return next()
      }
      // Don't log every bad session — they're noisy when a logged-out
      // browser has stale state. Just fall through to 401.
    }
  }

  return c.json({ error: 'auth_required' }, 401)
}
