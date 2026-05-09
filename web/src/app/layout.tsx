import type { Metadata, Viewport } from 'next'
import { Cormorant_Garamond, Inter } from 'next/font/google'
import { BRAND } from '@/lib/brand'
import { SiteHeader } from '@/components/brand/header'
import { SiteFooter } from '@/components/brand/footer'
import './globals.css'

const display = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '600'],
  display: 'swap',
  variable: '--font-display',
})
const body = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-body',
})

export const viewport: Viewport = {
  themeColor: '#FBF6E8',
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  metadataBase: new URL(BRAND.origin),
  title: { default: `${BRAND.name} — ${BRAND.tagline}`, template: `%s · ${BRAND.name}` },
  description: `${BRAND.tagline} ${BRAND.slogan} Real cakes, made by hand in our Sugar Land kitchen.`,
  applicationName: BRAND.name,
  alternates: {
    canonical: '/',
    types: { 'application/llms.txt': '/llms.txt' },
  },
  openGraph: {
    type: 'website',
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: BRAND.slogan,
    siteName: BRAND.name,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: BRAND.slogan,
  },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: '/apple-icon.png',
  },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-screen bg-cream-50 text-ink antialiased font-body">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-happy-900 focus:px-3 focus:py-2 focus:text-cream-50"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="min-h-[60vh]">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  )
}
