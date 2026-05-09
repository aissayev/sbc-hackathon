'use client'

import * as React from 'react'

// The Telegram Mini App SDK injects window.Telegram.WebApp. When present we
// (a) tell TG we're ready, (b) expand to full height, (c) adopt theme bg,
// and (d) stash the raw initData on document so Server Actions / fetches can
// pull it via a hidden meta tag for HMAC verification on the backend.
type TgWebApp = {
  ready: () => void
  expand: () => void
  initData: string
  themeParams: { bg_color?: string; text_color?: string; hint_color?: string }
  colorScheme: 'light' | 'dark'
  MainButton?: { setText: (s: string) => void; show: () => void; hide: () => void; onClick: (cb: () => void) => void }
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp }
  }
}

export function MiniAppBridge() {
  const [active, setActive] = React.useState(false)
  React.useEffect(() => {
    const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined
    if (!tg) return
    tg.ready()
    tg.expand()
    setActive(true)
    if (tg.themeParams.bg_color) {
      document.documentElement.style.setProperty('--tg-bg', tg.themeParams.bg_color)
    }
    if (tg.initData) {
      const meta = document.createElement('meta')
      meta.name = 'x-telegram-init-data'
      meta.content = tg.initData
      document.head.appendChild(meta)
    }
  }, [])

  if (!active) return null
  return (
    <div className="fixed bottom-3 right-3 z-50 rounded-full bg-happy-700 text-cream-50 text-xs px-3 py-1.5 shadow-md">
      Telegram Mini App
    </div>
  )
}

// Hook for reading initData on the client when we need to attach it to fetches.
export function useInitData() {
  return React.useMemo(() => {
    if (typeof window === 'undefined') return null
    return window.Telegram?.WebApp?.initData ?? null
  }, [])
}
