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
  { href: '/admin/escalations', label: 'Escalations' },
  { href: '/admin/settings', label: 'Settings' },
]

export function AdminNav() {
  const pathname = usePathname()
  return (
    <nav className="flex gap-1 overflow-x-auto -mx-1 px-1">
      {ITEMS.map((it) => {
        const active = pathname === it.href || pathname.startsWith(it.href + '/')
        return (
          <Link
            key={it.href}
            href={it.href}
            className={cn(
              'px-4 h-10 inline-flex items-center rounded-md text-sm whitespace-nowrap',
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
  )
}
