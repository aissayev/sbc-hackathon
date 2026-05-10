// Owner password gate for the browser-side admin cockpit.
//
// Auth flow:
//   First run    → /admin/setup → setupOwnerPassword(plain) → password_hash stored
//   Login        → /admin/login → verifyOwnerPassword(plain) → signSession(actor)
//                  → cookie set on the response
//   Each request → admin-auth middleware extracts the cookie, verifies the
//                  HMAC, lets the request through if valid
//   Logout       → cookie cleared (session_secret unchanged so other open
//                  tabs stay valid)
//   Reset        → bun run auth:reset (clears password_hash, also rotates
//                  session_secret to invalidate all open sessions)
//
// Mini App path (X-Telegram-Init-Data) bypasses this entirely — Telegram
// has already authenticated the user via the init-data signature.
//
// Storage: argon2id via Bun.password (the password-hashing competition
// winner; recommended default in OWASP 2024). Bun ships this natively
// so we don't take on a dependency. Sessions are signed with HMAC-SHA256
// using a per-deployment session_secret persisted alongside the password
// hash — rotating it forces everyone to re-login.

import { getDb } from '../db/db.ts'

interface AuthRow {
  id: number
  password_hash: string | null
  session_secret: string
  created_at: number
  updated_at: number
}

function readSettings(): AuthRow | null {
  return (
    (getDb()
      .prepare('SELECT id, password_hash, session_secret, created_at, updated_at FROM auth_settings WHERE id = 1')
      .get() as AuthRow | undefined) ?? null
  )
}

/**
 * True if the singleton row has a non-null password_hash. Used by the
 * frontend redirect logic to pick /admin/setup vs /admin/login.
 */
export function isOwnerPasswordSet(): boolean {
  const row = readSettings()
  return Boolean(row?.password_hash)
}

/**
 * Get (or lazily create) the session secret. The first call after a
 * fresh DB generates a 32-byte hex secret and persists it. Subsequent
 * calls return the same value.
 */
export function getOrCreateSessionSecret(): string {
  const row = readSettings()
  if (row) return row.session_secret
  const secret = bytesToHex(crypto.getRandomValues(new Uint8Array(32)))
  const now = Date.now()
  getDb()
    .prepare(
      'INSERT INTO auth_settings (id, password_hash, session_secret, created_at, updated_at) VALUES (1, NULL, ?, ?, ?)',
    )
    .run(secret, now, now)
  return secret
}

/**
 * First-run setup. Refuses to run if a password is already set —
 * subsequent password changes need to come through changeOwnerPassword
 * (after a successful login) or `bun run auth:reset` (out-of-band).
 */
export async function setupOwnerPassword(
  plain: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const v = validatePassword(plain)
  if (!v.ok) return v
  if (isOwnerPasswordSet()) return { ok: false, reason: 'password already set' }

  const hash = await Bun.password.hash(plain, { algorithm: 'argon2id' })
  // Ensure the singleton row exists (with secret) before updating.
  getOrCreateSessionSecret()
  const now = Date.now()
  getDb()
    .prepare('UPDATE auth_settings SET password_hash = ?, updated_at = ? WHERE id = 1')
    .run(hash, now)
  return { ok: true }
}

/**
 * Verify a candidate password against the stored hash. Returns false
 * (with `ok: false`) when no password is set yet — login attempts in
 * that state should be rejected with the same shape the form expects.
 */
export async function verifyOwnerPassword(
  plain: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const row = readSettings()
  if (!row?.password_hash) return { ok: false, reason: 'password not set' }
  const ok = await Bun.password.verify(plain, row.password_hash)
  if (!ok) return { ok: false, reason: 'invalid password' }
  return { ok: true }
}

/**
 * Authenticated password change. Caller must verify the OLD password
 * separately (the route does so by requiring the existing session
 * cookie + the old-password field).
 */
export async function changeOwnerPassword(
  newPlain: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const v = validatePassword(newPlain)
  if (!v.ok) return v
  const hash = await Bun.password.hash(newPlain, { algorithm: 'argon2id' })
  const now = Date.now()
  getDb()
    .prepare('UPDATE auth_settings SET password_hash = ?, updated_at = ? WHERE id = 1')
    .run(hash, now)
  return { ok: true }
}

/**
 * Out-of-band reset. Wipes the password AND rotates the session secret
 * (so every open admin tab is forced to log in again — useful as a
 * panic button if a session token leaks). Used by bun run auth:reset.
 */
export function resetAuthSettings(): void {
  const newSecret = bytesToHex(crypto.getRandomValues(new Uint8Array(32)))
  const now = Date.now()
  getDb()
    .prepare(
      'UPDATE auth_settings SET password_hash = NULL, session_secret = ?, updated_at = ? WHERE id = 1',
    )
    .run(newSecret, now)
}

// ─── Session cookie ──────────────────────────────────────────────────────

/**
 * Cookie name used everywhere. Centralised so middleware + routes +
 * frontend redirects don't disagree.
 */
export const SESSION_COOKIE = 'hc_owner_session'

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

interface SessionPayload {
  /** Issued-at, ms epoch. */
  iat: number
  /** Expires-at, ms epoch. */
  exp: number
  /** Subject — currently always "owner" (single-tenant). Future: user id. */
  sub: string
}

/**
 * Sign a fresh session token. Format:
 *   base64url(json) "." base64url(hmac-sha256(json, session_secret))
 *
 * We don't bother with full JWT (no `alg`/`typ` headers etc.) — this is
 * a single-purpose token with one consumer (our own middleware). The
 * minimal shape keeps the hot path obvious and small.
 */
export async function signSession(): Promise<string> {
  const secret = getOrCreateSessionSecret()
  const now = Date.now()
  const payload: SessionPayload = { iat: now, exp: now + SESSION_TTL_MS, sub: 'owner' }
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)))
  const sig = b64url(await hmac(secret, body))
  return `${body}.${sig}`
}

/**
 * Verify a session token. Returns the payload on success or a reason
 * string on failure (suitable for a 401 response — don't leak details
 * to clients, but log the reason for debug).
 */
export async function verifySession(
  token: string,
): Promise<{ ok: true; payload: SessionPayload } | { ok: false; reason: string }> {
  if (!token || !token.includes('.')) return { ok: false, reason: 'malformed' }
  const [body, sig] = token.split('.', 2)
  const secret = readSettings()?.session_secret
  if (!secret) return { ok: false, reason: 'no_secret' }
  const expected = b64url(await hmac(secret, body))
  if (!constantTimeEqual(sig, expected)) return { ok: false, reason: 'bad_signature' }
  let payload: SessionPayload
  try {
    payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as SessionPayload
  } catch {
    return { ok: false, reason: 'bad_payload' }
  }
  if (typeof payload.exp !== 'number' || payload.exp < Date.now()) {
    return { ok: false, reason: 'expired' }
  }
  return { ok: true, payload }
}

// ─── helpers ─────────────────────────────────────────────────────────────

function validatePassword(plain: string): { ok: true } | { ok: false; reason: string } {
  if (typeof plain !== 'string') return { ok: false, reason: 'password must be a string' }
  if (plain.length < 8) return { ok: false, reason: 'password must be at least 8 characters' }
  if (plain.length > 256) return { ok: false, reason: 'password is too long' }
  return { ok: true }
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    out[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return out
}

async function hmac(secretHex: string, body: string): Promise<Uint8Array> {
  // crypto.subtle.importKey wants a "BufferSource" with an ArrayBuffer (not
  // SharedArrayBuffer). Decoding into a fresh Uint8Array (which lazily wraps
  // ArrayBuffer) and passing the raw ArrayBuffer is the typed-strict path.
  const keyBytes = hexToBytes(secretHex)
  const keyBuf = keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength) as ArrayBuffer
  const bodyBytes = new TextEncoder().encode(body)
  const bodyBuf = bodyBytes.buffer.slice(bodyBytes.byteOffset, bodyBytes.byteOffset + bodyBytes.byteLength) as ArrayBuffer
  const key = await crypto.subtle.importKey(
    'raw',
    keyBuf,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, bodyBuf)
  return new Uint8Array(sig)
}

function b64url(bytes: Uint8Array | string): string {
  const data = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function b64urlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)
  const bin = atob(padded)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
