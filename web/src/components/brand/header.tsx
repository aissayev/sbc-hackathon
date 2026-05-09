import Link from 'next/link'
import { BRAND } from '@/lib/brand'
import { cn } from '@/lib/utils'
import { Wordmark } from './wordmark'

const NAV = [
  { href: '/menu', label: 'Menu' },
  { href: '/about', label: 'Our story' },
  { href: '/policies', label: 'Allergens' },
  { href: '/chat', label: 'Chat' },
]

export function SiteHeader({ className }: { className?: string }) {
  return (
    <header className={cn('sticky top-0 z-30 bg-cream-50/85 backdrop-blur border-b border-happy-700/15', className)}>
      <div className="container flex items-center justify-between py-4 md:py-5">
        <Link href="/" aria-label={`${BRAND.name} home`} className="flex items-center gap-2">
          <Wordmark className="h-7 w-auto text-happy-700" />
        </Link>
        <nav className="hidden md:flex items-center gap-7 text-sm text-happy-900">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="hover:text-happy-500 transition-colors">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/order"
            className="inline-flex items-center rounded-md bg-happy-700 text-cream-50 text-sm font-medium px-4 h-10 hover:bg-happy-900 transition-colors"
          >
            Order a cake
          </Link>
        </div>
      </div>
      <nav className="md:hidden flex items-center gap-5 text-xs text-happy-900 px-4 pb-3 overflow-x-auto">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className="whitespace-nowrap hover:text-happy-500">
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  )
}
