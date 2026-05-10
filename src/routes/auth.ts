// Auth endpoints for the browser-side admin cockpit.
//
//   POST /api/auth/setup      first-run only — set the initial password
//   POST /api/auth/login      verify password + issue session cookie
//   POST /api/auth/logout     clear the session cookie
//   GET  /api/auth/status     who am I? (used by frontend to decide redirects)
//
// Mounted at the root level because /api/admin/* is gated by adminAuth
// middleware — we'd never be able to log in without a way through. The
// auth routes carry their own check on /setup (refuses if already set).
//
// Sibling design choices:
//   - Cookies are httpOnly + sameSite=Lax + secure (in prod). The browser
//     attaches them automatically on subsequent /api/admin/* calls; SSR
//     and the Mini App don't use them (they have their own paths).
//   - Setup is unauth (it can't require a password we haven't set yet),
//     but it ONE-SHOT — refuses to run a second time. To re-set, the
//     operator runs `bun run auth:reset` from the server.
//   - Login response intentionally returns the same generic shape on
//     "wrong password" / "no password set" / "rate limited" — never tell
//     a guesser whether the username is real (single-tenant: there's no
//     username, but the principle holds).

import { Hono } from 'hono'
import { setCookie, deleteCookie } from 'hono/cookie'
import {
  isOwnerPasswordSet,
  setupOwnerPassword,
  verifyOwnerPassword,
  signSession,
  SESSION_COOKIE,
} from '../domain/auth.ts'

export const authRoutes = new Hono()

const MAX_PASSWORD_LEN = 256

// Tiny 1-second pause on failed login — slows down naive guess loops
// without adding state. Doesn't replace a real rate limiter.
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

// Cookie options — same shape for every issuance so the frontend
// renewal flow doesn't need to remember which path/expiry was set.
function cookieOpts(prod: boolean) {
  return {
    httpOnly: true,
    sameSite: 'Lax' as const,
    secure: prod,
    path: '/',
    maxAge: 30 * 24 * 60 * 60, // 30 days, matches signSession TTL
  }
}

const isProd = process.env.NODE_ENV === 'production'

authRoutes.post('/api/auth/setup', async (c) => {
  if (isOwnerPasswordSet()) {
    // Don't reveal that a password is set vs not — but DO refuse the
    // setup. A 409 here is honest about the state without giving a
    // guesser an oracle, since /setup is only useful to a fresh install.
    return c.json({ ok: false, reason: 'already_set' }, 409)
  }

  let body: { password?: unknown; confirm?: unknown }
  try {
    body = (await c.req.json()) as typeof body
  } catch {
    return c.json({ ok: false, reason: 'invalid_json' }, 400)
  }

  const password = typeof body.password === 'string' ? body.password : ''
  const confirm = typeof body.confirm === 'string' ? body.confirm : ''
  if (!password || password.length > MAX_PASSWORD_LEN) {
    return c.json({ ok: false, reason: 'invalid password' }, 400)
  }
  if (password !== confirm) {
    return c.json({ ok: false, reason: 'passwords do not match' }, 400)
  }

  const r = await setupOwnerPassword(password)
  if (!r.ok) return c.json({ ok: false, reason: r.reason }, 400)

  // Auto-login after setup so the user lands straight on /admin/today.
  const token = await signSession()
  setCookie(c, SESSION_COOKIE, token, cookieOpts(isProd))
  return c.json({ ok: true })
})

authRoutes.post('/api/auth/login', async (c) => {
  let body: { password?: unknown }
  try {
    body = (await c.req.json()) as typeof body
  } catch {
    return c.json({ ok: false, reason: 'invalid_json' }, 400)
  }
  const password = typeof body.password === 'string' ? body.password : ''
  if (!password || password.length > MAX_PASSWORD_LEN) {
    await sleep(1000)
    return c.json({ ok: false, reason: 'invalid_credentials' }, 401)
  }

  const r = await verifyOwnerPassword(password)
  if (!r.ok) {
    await sleep(1000)
    return c.json({ ok: false, reason: 'invalid_credentials' }, 401)
  }

  const token = await signSession()
  setCookie(c, SESSION_COOKIE, token, cookieOpts(isProd))
  return c.json({ ok: true })
})

authRoutes.post('/api/auth/logout', (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
  return c.json({ ok: true })
})

// Lightweight status — frontend hits this to decide initial redirects.
// Never reveals the password hash, never reveals user-identifying info
// (single-tenant — there is none). Safe to call unauth.
authRoutes.get('/api/auth/status', (c) => {
  return c.json({
    password_set: isOwnerPasswordSet(),
    // The middleware sets this if a valid session cookie was found on
    // a separate /api/admin/* request. Here we just expose whether the
    // password gate exists — frontend handles the rest from cookie state.
  })
})
