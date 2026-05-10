'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, Phone } from 'lucide-react'
import { BRAND } from '@/lib/brand'
import { cn } from '@/lib/utils'
import { Wordmark } from './wordmark'

// Primary nav. Kept to four items on purpose — Stories + Chat live in the
// footer / inline links so the top bar can breathe. Mobile drawer mirrors
// this list plus the secondary links.
const NAV = [
  { href: '/menu', label: 'Menu' },
  { href: '/business', label: 'For business' },
  { href: '/about', label: 'Our story' },
  { href: '/policies', label: 'Visit & FAQ' },
]

const NAV_SECONDARY = [
  { href: '/blog', label: 'Stories' },
  { href: '/chat', label: 'Chat' },
]

export function SiteHeader() {
  const [open, setOpen] = React.useState(false)
  const pathname = usePathname()

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
        <Link href="/" aria-label={`${BRAND.name} home`} className="flex items-center -my-1">
          <Wordmark />
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
        <div className="hidden md:flex items-center">
          <Link
            href="/order"
            className="inline-flex items-center rounded-full bg-cocoa-700 text-cream text-sm font-medium px-5 h-10 hover:bg-cocoa-900 transition-colors"
          >
            Order a cake
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          className="md:hidden inline-flex items-center justify-center h-11 w-11 rounded-full bg-cream-100 text-cocoa-900 hover:bg-cream-200"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      </header>

      {/* Mobile drawer — rendered as a sibling of <header> because the
          header's backdrop-blur creates a containing block that would clip
          a fixed-positioned drawer to the header's height. */}
      <div
        className={cn(
          'md:hidden fixed inset-x-0 top-[60px] bottom-0 z-40 bg-cream overflow-y-auto transition-transform duration-300 ease-out',
          open ? 'translate-y-0' : '-translate-y-[110%] pointer-events-none',
        )}
      >
        <nav className="container pt-6 pb-8 flex flex-col gap-1">
          {[...NAV, ...NAV_SECONDARY].map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="px-3 py-3 rounded-xl text-cocoa-900 hover:bg-cream-200 text-lg font-medium border-b border-cocoa-700/10"
            >
              {n.label}
            </Link>
          ))}
          <Link
            href="/order"
            className="mt-6 inline-flex items-center justify-center rounded-full bg-cocoa-700 text-cream text-base font-medium px-5 h-12 hover:bg-cocoa-900"
          >
            Order a cake
          </Link>
          <a
            href={BRAND.phone.hrefTel}
            className="mt-3 inline-flex items-center justify-center rounded-full border border-cocoa-700/30 text-cocoa-900 text-base font-medium px-5 h-12"
          >
            <Phone className="mr-2 h-4 w-4" /> {BRAND.phone.display}
          </a>
        </nav>
      </div>
    </>
  )
}
