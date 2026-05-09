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

  return (
    <header className="sticky top-0 z-30 bg-cream/85 backdrop-blur border-b border-cocoa-700/12">
      <div className="container flex items-center justify-between gap-4 py-3 md:py-4">
        <Link href="/" aria-label={`${BRAND.name} home`} className="flex items-center gap-2">
          <Wordmark />
        </Link>
        <nav className="hidden md:flex items-center gap-7 text-sm text-cocoa-900">
          {NAV.map((n) => {
            const active = pathname === n.href || pathname.startsWith(n.href + '/')
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  'hover:text-sky transition-colors relative',
                  active && 'text-sky',
                )}
              >
                {n.label}
              </Link>
            )
          })}
        </nav>
        <div className="hidden md:flex items-center gap-3">
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
          className="md:hidden inline-flex items-center justify-center h-10 w-10 rounded-full bg-cream-100 text-cocoa-900 hover:bg-cream-200"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      <div
        className={cn(
          'md:hidden fixed inset-x-0 top-[60px] bottom-0 bg-cream transition-transform duration-300 ease-out',
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
    </header>
  )
}
