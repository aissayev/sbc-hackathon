'use client'

// When the admin pages are launched as a Telegram Mini App (via the bot's
// menu button or an inline `web_app` button), Telegram injects
// `window.Telegram.WebApp` with `initData` — a signed query string proving
// who the launching user is.
//
// This provider:
//  1. Loads `telegram-web-app.js` (idempotent) so `window.Telegram.WebApp`
//     exists when running outside the Telegram client.
//  2. If `WebApp.initData` is present, monkey-patches `window.fetch` to
//     attach `X-Telegram-Init-Data` to any request whose URL contains
//     `/api/admin/`. The backend verifies the signature against the bot
//     token (src/middleware/admin-auth.ts).
//  3. Calls `WebApp.ready()` + `WebApp.expand()` so the Mini App fills the
//     Telegram chrome and the close-button etc. behave correctly.
//
// Standalone visits (someone hits /admin in their browser without launching
// from the bot) still work — without initData, no header is set, and the
// backend either accepts the request (open mode) or returns 401. The page
// shell renders either way; the data calls fail gracefully.

import * as React from 'react'

interface TelegramWebApp {
  initData: string
  ready: () => void
  expand: () => void
  themeParams?: Record<string, string>
  colorScheme?: 'light' | 'dark'
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

const SCRIPT_SRC = 'https://telegram.org/js/telegram-web-app.js'

export function TgAppProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    let cancelled = false

    function activate(tg: TelegramWebApp) {
      if (cancelled) return
      if (!tg.initData) return // Loaded standalone, not as a Mini App.
      try {
        tg.ready()
        tg.expand()
      } catch {}

      // Patch fetch ONCE per page. We tag the patched function so HMR /
      // re-mounts don't stack interceptors. We assign the wrapped fn back
      // onto the original so static helpers (`fetch.preconnect`) are
      // preserved — TypeScript types `window.fetch` as `typeof fetch`
      // which carries those.
      const w = window as Window & { __tgFetchPatched?: boolean }
      if (w.__tgFetchPatched) return
      w.__tgFetchPatched = true
      const orig = window.fetch.bind(window)
      const wrapped = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
        if (!url.includes('/api/admin/')) return orig(input, init)
        const headers = new Headers(
          init?.headers ?? (input instanceof Request ? input.headers : undefined),
        )
        if (!headers.has('X-Telegram-Init-Data')) {
          headers.set('X-Telegram-Init-Data', tg.initData)
        }
        return orig(input, { ...init, headers })
      }
      window.fetch = Object.assign(wrapped, window.fetch) as typeof window.fetch
    }

    // Already loaded?
    const existing = window.Telegram?.WebApp
    if (existing) {
      activate(existing)
      return
    }

    // Inject the script. The Mini App SDK is small (< 5kb gz) and idempotent.
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`)
    const script = existingScript ?? document.createElement('script')
    if (!existingScript) {
      script.src = SCRIPT_SRC
      script.async = true
      document.head.appendChild(script)
    }
    const onLoad = () => {
      const tg = window.Telegram?.WebApp
      if (tg) activate(tg)
    }
    script.addEventListener('load', onLoad)
    return () => {
      cancelled = true
      script.removeEventListener('load', onLoad)
    }
  }, [])

  return <>{children}</>
}
