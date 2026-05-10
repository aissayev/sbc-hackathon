'use client'

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
  { href: '/admin/logs', label: 'Logs' },
  { href: '/admin/settings', label: 'Settings' },
]

export function AdminNav() {
  const pathname = usePathname()
  // Wrapper provides a right-edge fade so the user sees the row scrolls
  // even when the trailing tabs are clipped (8 tabs at typical phone
  // width = at least 2 off-screen).
  return (
    <div className="relative -mx-1">
      <nav
        className="flex gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory"
        aria-label="Admin sections"
      >
        {ITEMS.map((it) => {
          const active = pathname === it.href || pathname.startsWith(it.href + '/')
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                'px-4 h-10 inline-flex items-center rounded-md text-sm whitespace-nowrap snap-start',
                active
                  ? 'bg-cocoa-700 text-cream-50'
                  : 'text-cocoa-900 hover:bg-cream-100 border border-cocoa-700/15',
              )}
            >
              {it.label}
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
