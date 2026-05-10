'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const ITEMS = [
  { href: '/admin/today', label: 'Today' },
  { href: '/admin/inbox', label: 'Inbox' },
  { href: '/admin/posts', label: 'Posts' },
  { href: '/admin/campaigns', label: 'Campaigns' },
  { href: '/admin/channels', label: 'Channels' },
  { href: '/admin/orders', label: 'Orders' },
  { href: '/admin/checkouts', label: 'Checkouts' },
  { href: '/admin/customers', label: 'Customers' },
  { href: '/admin/careers', label: 'Careers' },
  { href: '/admin/escalations', label: 'Escalations' },
  { href: '/admin/settings', label: 'Settings' },
]

// Click-lag fix: server-component admin pages with `force-dynamic` block
// for 200–800ms on the server roundtrip before anything visible changes.
// This component pairs with `app/admin/loading.tsx` (Suspense skeleton
// swaps in instantly on tap) and a tiny `pendingHref` state here that
// lights the tapped tab as soon as the click fires — so the user sees
// "tap was received" before the route hydrates.
//
// Why not `useLinkStatus`? That hook ships with Next 15.3+. We're on
// 15.1.6 here. The pendingHref pattern below is the same shape, three
// lines cheaper, and works without an upgrade.
export function AdminNav() {
  const pathname = usePathname()
  const [pendingHref, setPendingHref] = React.useState<string | null>(null)

  // Clear the pending highlight as soon as the route actually changes.
  // We compare against the same active-prefix rule used for `active`
  // below so settings → settings/audit doesn't flicker.
  React.useEffect(() => {
    if (!pendingHref) return
    if (pathname === pendingHref || pathname.startsWith(pendingHref + '/')) {
      setPendingHref(null)
    }
  }, [pathname, pendingHref])

  return (
    <div className="relative -mx-1">
      <nav
        className="flex gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory"
        aria-label="Admin sections"
      >
        {ITEMS.map((it) => {
          const active = pathname === it.href || pathname.startsWith(it.href + '/')
          const pending = !active && pendingHref === it.href
          return (
            <Link
              key={it.href}
              href={it.href}
              prefetch
              onClick={() => {
                // Same-tab tap is a no-op for navigation; don't show pending.
                if (!active) setPendingHref(it.href)
              }}
              aria-current={active ? 'page' : undefined}
              aria-busy={pending || undefined}
              className={cn(
                'px-4 h-10 inline-flex items-center rounded-md text-sm whitespace-nowrap snap-start transition-colors',
                active
                  ? 'bg-cocoa-700 text-cream-50'
                  : pending
                    ? 'bg-cream-200 text-cocoa-900 border border-cocoa-700/25'
                    : 'text-cocoa-900 hover:bg-cream-100 border border-cocoa-700/15',
              )}
            >
              {it.label}
              {pending && (
                <span
                  aria-hidden
                  className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-sky animate-pulse"
                />
              )}
            </Link>
          )
        })}
      </nav>
      {/* Right-edge fade hint for horizontal overflow. Pointer-events-none
          so it doesn't block taps on the last visible tab. */}
      <div
        aria-hidden
        className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-cream to-transparent pointer-events-none md:hidden"
      />
    </div>
  )
}
