import type { Metadata } from 'next'
import { AdminNav } from '@/components/admin/admin-nav'
import { TgAppProvider } from '@/components/admin/tg-app-provider'
import { Eyebrow } from '@/components/brand/eyebrow'

export const metadata: Metadata = {
  title: 'Owner console',
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <TgAppProvider>
      <div>
        <section className="container pt-10 pb-6 border-b border-cocoa-700/15">
          <Eyebrow>Owner console</Eyebrow>
          <h1 className="display-h2 mt-2">Happy Cake control room</h1>
          <p className="mt-1 text-sm text-cocoa-900/70">
            Desktop view of orders, approvals, and escalations. The Telegram bot is the primary
            surface — it has approval buttons inline; this page is here for when you want a wider
            screen.
          </p>
          <div className="mt-5">
            <AdminNav />
          </div>
        </section>
        <div className="container py-8">{children}</div>
      </div>
    </TgAppProvider>
  )
}
