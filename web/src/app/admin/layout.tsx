import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { AdminNav } from '@/components/admin/admin-nav'
import { TgAppProvider } from '@/components/admin/tg-app-provider'
import { Eyebrow } from '@/components/brand/eyebrow'

export const metadata: Metadata = {
  title: 'Owner console',
  robots: { index: false, follow: false },
}

// Auth pages (login + setup) need to render WITHOUT the cockpit chrome
// — they're standalone screens. We can't use a Next route group to bail
// out of this layout because route groups only ADD wrappers, they don't
// escape. Instead, our /admin/* middleware (web/middleware.ts) sets
// x-pathname on the request; we read it here and skip the chrome on
// auth paths. Mini App and authed-cockpit paths get the full chrome.
const AUTH_PATHS = new Set(['/admin/login', '/admin/setup'])

// Layout is mobile-first: this page is the canonical owner cockpit
// inside a Telegram Mini App on a phone, with desktop-browser use as
// the secondary case. Tight padding by default, expands on `md+`. The
// intro paragraph is hidden on small screens.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const h = await headers()
  const pathname = h.get('x-pathname') ?? ''
  const isAuthPage = AUTH_PATHS.has(pathname)

  if (isAuthPage) {
    // Standalone screens — no admin chrome, just the page itself.
    // TgAppProvider still wraps so initData-launched browsers don't
    // accidentally bypass, though in practice these routes are skipped
    // by the middleware Mini App check anyway.
    return <TgAppProvider>{children}</TgAppProvider>
  }

  return (
    <TgAppProvider>
      <div data-admin-shell>
        {/* Header band hides inside Telegram Mini App via the
            .is-tg-mini-app [data-admin-shell-header] CSS rule —
            Telegram supplies its own chrome at the top, so the
            "Happy Cake control room" eyebrow + title + intro just
            wastes the first 140px of viewport. Outside Telegram
            (regular web), it renders normally. */}
        <section
          data-admin-shell-header
          className="container pt-4 md:pt-10 pb-4 md:pb-6 border-b border-cocoa-700/15"
        >
          <Eyebrow>Owner console</Eyebrow>
          <h1 className="text-2xl md:display-h2 mt-1.5 md:mt-2 font-display font-medium tracking-tight">
            Happy Cake control room
          </h1>
          <p className="mt-1 text-sm text-cocoa-900/70 hidden md:block">
            Orders, approvals, escalations. The Telegram bot is the primary surface — approval
            buttons land inline there; this page mirrors the same data on a wider screen.
          </p>
          <div className="mt-3 md:mt-5">
            <AdminNav />
          </div>
        </section>
        {/* In Mini App, surface the AdminNav inline up top since the
            chrome above is suppressed. Hidden on regular web (the
            header section already includes a copy). */}
        <div data-admin-shell-mini-nav className="container pt-3 pb-1 hidden">
          <AdminNav />
        </div>
        <div className="container py-4 md:py-8">{children}</div>
      </div>
    </TgAppProvider>
  )
}
