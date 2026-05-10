'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Menu,
  X,
  Phone,
  Mail,
  MapPin,
  Instagram,
  ShoppingBag,
  ChevronRight,
} from 'lucide-react'
import { BRAND } from '@/lib/brand'
import { cn } from '@/lib/utils'
import { Wordmark } from './wordmark'
import { isOpenNow } from './hours'

// Primary nav. Kept to four items on purpose — Stories + Chat live in the
// footer / inline links so the top bar can breathe. Mobile drawer mirrors
// this list plus the secondary links.
const NAV = [
  { href: '/menu', label: 'Menu' },
  { href: '/business', label: 'Catering' },
  { href: '/about', label: 'About us' },
  { href: '/policies', label: 'Visit & FAQ' },
]

const NAV_SECONDARY = [
  { href: '/blog', label: 'Stories' },
  { href: '/chat', label: 'Chat' },
]

export function SiteHeader() {
  const [open, setOpen] = React.useState(false)
  const pathname = usePathname()
  const status = isOpenNow()

  // Close the drawer on route change so the user lands on a fresh page.
  React.useEffect(() => { setOpen(false) }, [pathname])
  React.useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      <header className="sticky top-0 z-30 bg-cream/85 backdrop-blur supports-[backdrop-filter]:bg-cream/70 border-b border-cocoa-700/10">
        <div className="container flex items-center justify-between gap-4 py-2.5 md:py-3">
          {/* Logo uses size="lg" — wordmark renders ~30% bigger via negative
              vertical margins so the row height stays the same as before
              (driven by the 40px nav links + button). */}
          <Link href="/" aria-label={`${BRAND.name} home`} className="flex items-center">
            <Wordmark size="lg" />
          </Link>
          <nav className="hidden md:flex items-center gap-1 text-sm text-cocoa-900">
            {NAV.map((n) => {
              const active = pathname === n.href || pathname.startsWith(n.href + '/')
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn(
                    'inline-flex items-center h-10 px-3 rounded-full font-medium transition-colors',
                    active
                      ? 'bg-sky/10 text-sky-700'
                      : 'text-cocoa-900/85 hover:bg-cream-200 hover:text-cocoa-900',
                  )}
                >
                  {n.label}
                </Link>
              )
            })}
          </nav>
          <div className="hidden md:flex items-center gap-3">
            <HeaderStatus />
            <a
              href={BRAND.phone.hrefTel}
              className="hidden lg:inline-flex items-center gap-1.5 text-sm text-cocoa-900/75 hover:text-cocoa-900 transition-colors"
            >
              <Phone className="h-3.5 w-3.5" />
              {BRAND.phone.display}
            </a>
            <Link
              href="/order"
              className="inline-flex items-center rounded-full bg-sky text-white text-sm font-medium px-5 h-10 hover:bg-sky-700 transition-colors shrink-0 shadow-sm"
            >
              Order a cake
            </Link>
          </div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            className="md:hidden inline-flex items-center justify-center h-11 w-11 rounded-full bg-cream-100 text-cocoa-900 hover:bg-cream-200 transition-colors"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* Mobile drawer — rendered as a sibling of <header> because the
          header's backdrop-blur creates a containing block that would clip
          a fixed-positioned drawer to the header's height. Uses opacity +
          visibility for hide/show (translate-y-[110%] computed against the
          element's collapsed bbox and leaked the menu through). */}
      <div
        className={cn(
          'md:hidden fixed inset-x-0 top-[64px] z-40 bg-cream overflow-y-auto transition-opacity duration-200 ease-out',
          open ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none',
        )}
        style={{ height: 'calc(100dvh - 64px)' }}
      >
        <div className="container pt-5 pb-10 flex flex-col gap-6">
          {/* Live open-now indicator at the top — answers the first question a
              touch user has when they pop the drawer ("are you open right now?"). */}
          <div
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium self-start',
              status.open ? 'bg-emerald-100 text-emerald-800' : 'bg-cream-200 text-cocoa-900/75',
            )}
          >
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                status.open ? 'bg-emerald-600 animate-pulse' : 'bg-cocoa-700/45',
              )}
              aria-hidden
            />
            {status.open ? 'Open now' : 'Closed'} · {status.nextChange}
          </div>

          <nav>
            <p className="text-[11px] uppercase tracking-[0.18em] text-cocoa-900/55 font-medium mb-2 px-2">
              Browse
            </p>
            <ul className="grid">
              {[...NAV, ...NAV_SECONDARY].map((n) => {
                const active = pathname === n.href || pathname.startsWith(n.href + '/')
                return (
                  <li key={n.href}>
                    <Link
                      href={n.href}
                      className={cn(
                        'flex items-center justify-between gap-3 px-3 py-3.5 rounded-xl text-lg font-medium transition-colors',
                        active
                          ? 'bg-sky/10 text-sky-800'
                          : 'text-cocoa-900 hover:bg-cream-200',
                      )}
                    >
                      <span>{n.label}</span>
                      <ChevronRight
                        className={cn('h-4 w-4', active ? 'text-sky-700' : 'text-cocoa-900/35')}
                      />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>

          <div className="grid gap-3">
            <Link
              href="/order"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-sky text-white text-base font-medium px-5 h-12 hover:bg-sky-700 shadow-sm"
            >
              <ShoppingBag className="h-4 w-4" />
              Order a cake
            </Link>
            <a
              href={BRAND.phone.hrefTel}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-cocoa-700/25 text-cocoa-900 text-base font-medium px-5 h-12 hover:bg-cream-200"
            >
              <Phone className="h-4 w-4" /> {BRAND.phone.display}
            </a>
          </div>

          <div className="pt-4 border-t border-cocoa-700/10 text-sm text-cocoa-900/75 grid gap-2.5">
            <a
              href={BRAND.mapsUrl}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 hover:text-cocoa-900"
            >
              <MapPin className="h-4 w-4 text-cocoa-900/55" />
              {BRAND.address.line1}, {BRAND.address.city}
            </a>
            <a
              href={`mailto:${BRAND.email}`}
              className="inline-flex items-center gap-2 hover:text-cocoa-900"
            >
              <Mail className="h-4 w-4 text-cocoa-900/55" />
              {BRAND.email}
            </a>
            <a
              href={BRAND.instagram}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 hover:text-cocoa-900"
            >
              <Instagram className="h-4 w-4 text-cocoa-900/55" />
              {BRAND.instagramHandle}
            </a>
          </div>
        </div>
      </div>
    </>
  )
}

// "Open now · 11–7" pill in the header. Mounts client-side because the
// open/closed math depends on the current time in America/Chicago — SSR
// would freeze the badge to whatever it was at build time. We hide the
// pill until the first client tick so we don't flash a stale state.
function HeaderStatus() {
  const [status, setStatus] = React.useState<{ open: boolean; nextChange?: string } | null>(null)
  React.useEffect(() => {
    setStatus(isOpenNow())
    // Re-check every minute so the pill flips at opening / closing time
    // without a page refresh.
    const id = setInterval(() => setStatus(isOpenNow()), 60_000)
    return () => clearInterval(id)
  }, [])
  if (!status) {
    // Reserve the same approximate width during hydration so the layout
    // doesn't shift when the pill mounts.
    return <span aria-hidden className="hidden lg:inline-block w-44 h-7" />
  }
  return (
    <Link
      href="/policies#hours"
      title="Tap for full hours"
      className="hidden lg:inline-flex items-center gap-2 rounded-full border border-cocoa-700/15 bg-white/60 backdrop-blur px-3 h-8 text-xs text-cocoa-900/85 hover:text-cocoa-900 hover:bg-white transition-colors"
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          status.open ? 'bg-emerald-500' : 'bg-cocoa-700/45',
        )}
      />
      <span className="font-medium">{status.open ? 'Open now' : 'Closed'}</span>
      {status.nextChange && (
        <span className="text-cocoa-900/55">· {status.nextChange}</span>
      )}
    </Link>
  )
}
