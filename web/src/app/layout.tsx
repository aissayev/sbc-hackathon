import type { Metadata, Viewport } from 'next'
import { Playfair_Display, Inter } from 'next/font/google'
import { BRAND, ASSETS } from '@/lib/brand'
import { SiteHeader } from '@/components/brand/header'
import { SiteFooter } from '@/components/brand/footer'
import { Providers } from '@/components/providers'
import { HelpWidget } from '@/components/help-widget/help-widget'
import './globals.css'

const display = Playfair_Display({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  display: 'swap',
  variable: '--font-display',
})
const body = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  display: 'swap',
  variable: '--font-body',
})

export const viewport: Viewport = {
  themeColor: '#FFF7EA',
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  metadataBase: new URL(BRAND.origin),
  title: { default: `${BRAND.name} — ${BRAND.tagline}`, template: `%s · ${BRAND.name}` },
  description: BRAND.slogan,
  applicationName: BRAND.name,
  alternates: {
    canonical: '/',
    types: { 'application/llms.txt': '/llms.txt' },
  },
  // Social-card image is a real shot of our counter (a slice + branded iced
  // coffee under the Happy Cake neon) — outperforms an abstract product photo
  // because it telegraphs "real café, real seat" in the link preview.
  openGraph: {
    type: 'website',
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: BRAND.slogan,
    siteName: BRAND.name,
    locale: 'en_US',
    images: [
      {
        url: ASSETS.store.coffeeAndCake,
        width: 1280,
        height: 936,
        alt: 'Happy Cake — a slice of cake and an iced coffee under our neon sign',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: BRAND.slogan,
    images: [ASSETS.store.coffeeAndCake],
  },
  // Icons resolve via the App Router file convention:
  //   app/favicon.ico    → /favicon.ico (legacy fallback for old browsers)
  //   app/icon.png       → /icon.png   (256×256, official Happy Cake logo from
  //                        the hackathon CDN — same source the header + hero use)
  //   app/apple-icon.png → /apple-icon.png (512×512)
  // No `icons` block needed; Next picks them up automatically.
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-screen bg-cream text-ink antialiased font-body">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-cocoa-900 focus:px-3 focus:py-2 focus:text-cream"
        >
          Skip to content
        </a>
        <Providers>
          <SiteHeader />
          <main id="main" className="min-h-[60vh]">
            {children}
          </main>
          <SiteFooter />
          <HelpWidget />
        </Providers>
      </body>
    </html>
  )
}
