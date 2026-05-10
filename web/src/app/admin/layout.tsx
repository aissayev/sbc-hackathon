import type { Metadata } from 'next'
import { AdminNav } from '@/components/admin/admin-nav'
import { TgAppProvider } from '@/components/admin/tg-app-provider'
import { Eyebrow } from '@/components/brand/eyebrow'

export const metadata: Metadata = {
  title: 'Owner console',
  robots: { index: false, follow: false },
}

// Layout is mobile-first now: this page is the canonical owner cockpit
// inside a Telegram Mini App on a phone, with desktop-browser use as the
// secondary case. Tight padding by default, expands on `md+`. The intro
// paragraph is hidden on small screens (the title + nav speak for
// themselves; the explainer is only useful on a wide screen where it
// fits comfortably).
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <TgAppProvider>
      <div>
        <section className="container pt-4 md:pt-10 pb-4 md:pb-6 border-b border-cocoa-700/15">
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
        <div className="container py-4 md:py-8">{children}</div>
      </div>
    </TgAppProvider>
  )
}
