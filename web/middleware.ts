// Auth gate for /admin/* routes.
//
// Three signals decide what to do:
//
//   A. Owner password set?     /api/auth/status.password_set
//   B. Session cookie present? hc_owner_session
//   C. Telegram Mini App?      ?tgWebAppData= in the URL or
//                              referrer === t.me / Telegram desktop UA
//
// Logic:
//   not (A) && path != /admin/setup → redirect to /admin/setup
//   (A) && !B && !C  && path != /admin/login → redirect to /admin/login
//   else → fall through (page renders; backend cookie / init-data
//          gates the actual data fetch)
//
// Mini App detection is best-effort — Telegram doesn't always pass a
// stable header. We default to letting the request through if we
// suspect Mini App context, since the backend's init-data check is
// the real auth gate for that path. This middleware is just a UX nicety:
// to redirect plain browsers to the right onboarding screen.

import { NextResponse, type NextRequest } from 'next/server'

const SESSION_COOKIE = 'hc_owner_session'
const SETUP_PATH = '/admin/setup'
const LOGIN_PATH = '/admin/login'

// Routes inside /admin that should never be redirected (the auth pages
// themselves). Anything else under /admin is gated.
const PUBLIC_ADMIN_PATHS = new Set([SETUP_PATH, LOGIN_PATH])

function isMiniAppContext(req: NextRequest): boolean {
  // Telegram passes initData via the URL fragment which we can't read
  // server-side. Best server-visible signals:
  //   - Referrer is one of Telegram's web origins
  //   - User-Agent contains "Telegram"
  // Either is sufficient — neither is forgeable in a way that creates
  // an auth bypass (the actual auth happens in the backend via the
  // init-data signature check on /api/admin/*).
  const ref = req.headers.get('referer') ?? ''
  const ua = req.headers.get('user-agent') ?? ''
  return /tgwebapp|telegram\.org|web\.telegram\.org/i.test(ref) || /Telegram/i.test(ua)
}

async function fetchAuthStatus(req: NextRequest): Promise<{ passwordSet: boolean }> {
  // Hit the backend through the same proxy chain the browser would use.
  // BACKEND_URL is the server-side proxy target (see next.config.mjs);
  // in dev that's localhost, in prod the real backend host.
  const backend =
    process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3000'
  try {
    const res = await fetch(`${backend}/api/auth/status`, {
      cache: 'no-store',
      headers: { 'user-agent': req.headers.get('user-agent') ?? '' },
    })
    if (!res.ok) return { passwordSet: false }
    const data = (await res.json()) as { password_set?: boolean }
    return { passwordSet: data.password_set === true }
  } catch {
    // If we can't reach the backend, fall through to "no password set".
    // Worst case the user lands on /admin/setup, which itself fails to
    // POST cleanly — a clearer signal than a silent 500.
    return { passwordSet: false }
  }
}

// Pass the path through to server components so the layout can decide
// whether to render the cockpit chrome (the auth pages need to render
// without it).
function passThroughWithPathname(req: NextRequest) {
  const headers = new Headers(req.headers)
  headers.set('x-pathname', req.nextUrl.pathname)
  return NextResponse.next({ request: { headers } })
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (!pathname.startsWith('/admin')) return NextResponse.next()

  if (PUBLIC_ADMIN_PATHS.has(pathname)) {
    // If the user is already authed (has a session cookie + password is
    // set) and they're on the login page, bounce them to the cockpit
    // home. Setup is treated the same — re-running it is blocked
    // backend-side anyway.
    const cookie = req.cookies.get(SESSION_COOKIE)
    if (cookie?.value) {
      const { passwordSet } = await fetchAuthStatus(req)
      if (passwordSet) {
        const url = req.nextUrl.clone()
        url.pathname = '/admin/today'
        url.search = ''
        return NextResponse.redirect(url)
      }
    }
    return passThroughWithPathname(req)
  }

  // Mini App requests bypass the redirect — backend init-data check is
  // the real auth gate for that path.
  if (isMiniAppContext(req)) return passThroughWithPathname(req)

  const { passwordSet } = await fetchAuthStatus(req)
  if (!passwordSet) {
    const url = req.nextUrl.clone()
    url.pathname = SETUP_PATH
    return NextResponse.redirect(url)
  }

  // Password is set — require a session cookie. If missing, send to login.
  const cookie = req.cookies.get(SESSION_COOKIE)
  if (!cookie || !cookie.value) {
    const url = req.nextUrl.clone()
    url.pathname = LOGIN_PATH
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Cookie present — let the page render. The backend re-verifies the
  // signature on every /api/admin/* call, so a forged/expired cookie
  // produces a 401 from there even if it slipped past us here.
  return passThroughWithPathname(req)
}

export const config = {
  // Run only on /admin/* — keep customer-facing routes free of the proxy
  // round-trip on every navigation.
  matcher: ['/admin/:path*'],
}
