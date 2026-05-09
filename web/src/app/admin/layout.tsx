import type { Metadata } from 'next'
import Script from 'next/script'
import { MiniAppBridge } from '@/components/admin/mini-app-bridge'
import { AdminNav } from '@/components/admin/admin-nav'
import { Eyebrow } from '@/components/brand/eyebrow'

export const metadata: Metadata = {
  title: 'Owner console',
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <MiniAppBridge />
      <section className="container pt-10 pb-6 border-b border-happy-700/15">
        <Eyebrow>Owner console</Eyebrow>
        <h1 className="display-h2 mt-2">HappyCake control room</h1>
        <p className="mt-1 text-sm text-happy-900/70">
          For Askhat. Same surface as the Telegram bot — works in a browser with the login widget,
          or as a Telegram Mini App.
        </p>
        <div className="mt-5">
          <AdminNav />
        </div>
      </section>
      <div className="container py-8">{children}</div>
    </div>
  )
}
