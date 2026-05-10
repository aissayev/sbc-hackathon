// Verify a Telegram Mini App's `initData` query string against the bot token.
//
// Telegram's protocol (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app):
//
//   1. The bot token is the secret. Derive a per-bot signing key:
//        secretKey = HMAC_SHA256(key="WebAppData", data=botToken)
//   2. Build a "data check string" from the params, EXCLUDING `hash`:
//        - URL-decode each value
//        - sort keys alphabetically
//        - join as `key=value` lines separated by '\n'
//   3. Expected hash:
//        HMAC_SHA256(key=secretKey, data=dataCheckString).toString('hex')
//   4. Constant-time compare against the `hash` param.
//
// We additionally enforce an `auth_date` freshness window — Telegram includes
// the unix timestamp at which the WebApp was opened. Stale init-data should
// never authenticate a session weeks later. Default 24h.

import { createHmac, timingSafeEqual } from 'node:crypto'

export interface TelegramInitDataUser {
  id: number
  is_bot?: boolean
  first_name?: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
}

export type VerifyResult =
  | { ok: true; user?: TelegramInitDataUser; authDate: number }
  | { ok: false; reason: 'no_hash' | 'no_secret' | 'mismatch' | 'expired' | 'malformed' }

interface VerifyOpts {
  /** Hard cap on init-data age in seconds. Default 24h. */
  maxAgeSec?: number
}

export function verifyTelegramInitData(
  initData: string,
  botToken: string | undefined,
  opts: VerifyOpts = {},
): VerifyResult {
  if (!botToken) return { ok: false, reason: 'no_secret' }
  let params: URLSearchParams
  try {
    params = new URLSearchParams(initData)
  } catch {
    return { ok: false, reason: 'malformed' }
  }
  const hash = params.get('hash')
  if (!hash) return { ok: false, reason: 'no_hash' }

  // Build the data-check string. Exclude `hash`, sort by key, join with '\n'.
  const entries: Array<[string, string]> = []
  for (const [k, v] of params.entries()) {
    if (k === 'hash') continue
    entries.push([k, v])
  }
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n')

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const expected = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  // Constant-time compare. Both buffers must be the same length, which they
  // will be (sha256 hex = 64 chars), but guard anyway.
  const a = Buffer.from(hash, 'hex')
  const b = Buffer.from(expected, 'hex')
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: 'mismatch' }
  }

  // Freshness check. Telegram emits auth_date as unix seconds.
  const maxAgeSec = opts.maxAgeSec ?? 24 * 60 * 60
  const authDateRaw = params.get('auth_date')
  const authDate = authDateRaw ? Number(authDateRaw) : NaN
  if (!Number.isFinite(authDate)) {
    return { ok: false, reason: 'malformed' }
  }
  const ageSec = Math.floor(Date.now() / 1000) - authDate
  if (ageSec > maxAgeSec) {
    return { ok: false, reason: 'expired' }
  }

  // The `user` field is JSON-encoded inside the query string.
  const userJson = params.get('user')
  let user: TelegramInitDataUser | undefined
  if (userJson) {
    try {
      user = JSON.parse(userJson) as TelegramInitDataUser
    } catch {
      return { ok: false, reason: 'malformed' }
    }
  }

  return { ok: true, user, authDate }
}
