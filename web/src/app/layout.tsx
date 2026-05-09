import type { Metadata, Viewport } from 'next'
import { Playfair_Display, Inter } from 'next/font/google'
import { BRAND, ASSETS } from '@/lib/brand'
import { SiteHeader } from '@/components/brand/header'
import { SiteFooter } from '@/components/brand/footer'
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
  openGraph: {
    type: 'website',
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: BRAND.slogan,
    siteName: BRAND.name,
    locale: 'en_US',
    images: [{ url: ASSETS.hero[0], width: 1600, height: 1000, alt: 'Happy Cake' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: BRAND.slogan,
    images: [ASSETS.hero[0]],
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: ASSETS.logo.px256, type: 'image/png', sizes: '256x256' },
    ],
    apple: ASSETS.logo.px512,
  },
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
        <SiteHeader />
        <main id="main" className="min-h-[60vh]">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  )
}
