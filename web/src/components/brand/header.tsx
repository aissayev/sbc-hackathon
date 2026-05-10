'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, Phone } from 'lucide-react'
import { BRAND } from '@/lib/brand'
import { cn } from '@/lib/utils'
import { Wordmark } from './wordmark'

const NAV = [
  { href: '/menu', label: 'Menu' },
  { href: '/business', label: 'For business' },
  { href: '/about', label: 'Our story' },
  { href: '/blog', label: 'Stories' },
  { href: '/policies', label: 'Visit & FAQ' },
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

  // Bigger logo on the home page (the marketing surface) — every other
  // page keeps the standard sized lockup so the chrome doesn't fight the
  // page hero. Same component, two scales.
  const isHome = pathname === '/'

  return (
    <>
      <header className="sticky top-0 z-30 bg-cream/85 backdrop-blur supports-[backdrop-filter]:bg-cream/70 border-b border-cocoa-700/10">
      <div
        className={cn(
          'container flex items-center justify-between gap-4 transition-[padding] duration-200',
          isHome ? 'py-3 md:py-4' : 'py-2.5 md:py-3',
        )}
      >
        <Link href="/" aria-label={`${BRAND.name} home`} className="flex items-center -my-1">
          <Wordmark size={isHome ? 'lg' : 'md'} />
        </Link>
        <nav className="hidden lg:flex items-center gap-1 text-sm text-cocoa-900">
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
        <div className="hidden lg:flex items-center gap-3">
          <a
            href={BRAND.phone.hrefTel}
            className="text-sm text-cocoa-900/70 hover:text-cocoa-900 inline-flex items-center gap-1.5"
          >
            <Phone className="h-3.5 w-3.5" /> {BRAND.phone.display}
          </a>
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
          className="lg:hidden inline-flex items-center justify-center h-11 w-11 rounded-full bg-cream-100 text-cocoa-900 hover:bg-cream-200"
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
          'lg:hidden fixed inset-x-0 top-[64px] bottom-0 z-40 bg-cream overflow-y-auto transition-transform duration-300 ease-out',
          open ? 'translate-y-0' : '-translate-y-[110%] pointer-events-none',
        )}
      >
        <nav className="container pt-6 pb-8 flex flex-col gap-1">
          {NAV.map((n) => (
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
