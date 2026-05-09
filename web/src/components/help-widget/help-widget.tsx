'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  HelpCircle,
  X,
  ChevronRight,
  ChevronLeft,
  MessageSquareHeart,
  Package,
  Sparkles,
  Building2,
  Search as SearchIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Wordmark } from '@/components/brand/wordmark'
import { TrackOrder } from './track-order'
import { WIDGET_FAQ } from '@/lib/widget'

type View = 'home' | 'track' | 'faq'

// Routes where the floating widget shouldn't appear: the full chat page is
// already the chat surface, the admin console is for the owner not customers,
// and any nested admin routes inherit the same skip.
function shouldHide(pathname: string | null): boolean {
  if (!pathname) return false
  if (pathname.startsWith('/admin')) return true
  if (pathname === '/chat') return true
  return false
}

export function HelpWidget() {
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)
  const [view, setView] = React.useState<View>('home')

  React.useEffect(() => {
    // Persist open/closed across reloads so a customer reading FAQ before
    // ordering doesn't have to click the launcher again on every page.
    try {
      const saved = localStorage.getItem('hc_widget_open')
      if (saved === 'true') setOpen(true)
    } catch {}
  }, [])

  React.useEffect(() => {
    try { localStorage.setItem('hc_widget_open', String(open)) } catch {}
  }, [open])

  // Close + go home on route change so deep-links don't land on a stale view.
  React.useEffect(() => { setView('home') }, [pathname])

  if (shouldHide(pathname)) return null

  return (
    <>
      <Launcher open={open} onClick={() => setOpen((v) => !v)} />
      {open && (
        <Card view={view} setView={setView} onClose={() => setOpen(false)} />
      )}
    </>
  )
}

function Launcher({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={open ? 'Close help' : 'Open help'}
      aria-expanded={open}
      className={cn(
        'fixed z-40 rounded-full shadow-lift transition-transform hover:scale-105',
        'bottom-5 right-5 md:bottom-6 md:right-6',
        open ? 'bg-cocoa-700 text-cream' : 'bg-sky text-white',
        'h-14 w-14 inline-flex items-center justify-center',
      )}
    >
      {open ? <X className="h-6 w-6" /> : <HelpCircle className="h-6 w-6" />}
    </button>
  )
}

function Card({
  view,
  setView,
  onClose,
}: {
  view: View
  setView: (v: View) => void
  onClose: () => void
}) {
  return (
    <div
      role="dialog"
      aria-label="Help and shortcuts"
      className={cn(
        'fixed z-40 bg-bakery shadow-lift overflow-hidden flex flex-col',
        // Mobile: nearly full-screen bottom sheet
        'inset-x-3 bottom-24 top-[10vh] rounded-3xl',
        // Desktop: floating card
        'md:inset-auto md:bottom-24 md:right-6 md:top-auto md:w-[380px] md:h-[560px] md:rounded-2xl',
        'animate-fade-in',
      )}
    >
      <CardHeader view={view} setView={setView} onClose={onClose} />
      <div className="flex-1 overflow-y-auto">
        {view === 'home' && <HomeView setView={setView} />}
        {view === 'track' && (
          <div className="p-5">
            <TrackOrder />
          </div>
        )}
        {view === 'faq' && <FaqView />}
      </div>
      <CardFooter />
    </div>
  )
}

function CardHeader({
  view,
  setView,
  onClose,
}: {
  view: View
  setView: (v: View) => void
  onClose: () => void
}) {
  const titles: Record<View, string> = {
    home: 'Hi — how can we help?',
    track: 'Track your order',
    faq: 'Common questions',
  }
  return (
    <div className="px-5 py-4 border-b border-cocoa-700/10 bg-cream-50">
      <div className="flex items-center justify-between gap-3">
        {view === 'home' ? (
          <Wordmark variant="wordmark-only" className="text-base" />
        ) : (
          <button
            type="button"
            onClick={() => setView('home')}
            className="text-sm text-sky-700 hover:text-sky inline-flex items-center gap-1"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="h-8 w-8 inline-flex items-center justify-center rounded-full hover:bg-cream-200 text-cocoa-900"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-2 font-display text-xl text-cocoa-900">{titles[view]}</p>
    </div>
  )
}

function HomeView({ setView }: { setView: (v: View) => void }) {
  return (
    <div className="p-3">
      <p className="px-2 pt-2 pb-3 text-xs text-cocoa-900/60">Quick options</p>
      <div className="space-y-1.5">
        <ActionRow
          icon={MessageSquareHeart}
          tone="bg-sky-100 text-sky-700"
          title="Browse with guidance"
          subtitle="Chat with us — we'll suggest a cake based on what you're celebrating."
          asLink
          href="/chat"
          external
        />
        <ActionRow
          icon={Package}
          tone="bg-emerald-100 text-emerald-700"
          title="Track my order"
          subtitle="Paste an order id, get a live status."
          onClick={() => setView('track')}
        />
        <ActionRow
          icon={SearchIcon}
          tone="bg-cream-200 text-cocoa-700"
          title="FAQ"
          subtitle="Lead times, allergens, delivery, payment."
          onClick={() => setView('faq')}
        />
        <ActionRow
          icon={Sparkles}
          tone="bg-berry-100 text-berry"
          title="Customize a cake"
          subtitle="Five quick steps. Askhat quotes by phone."
          asLink
          href="/order/custom"
        />
        <ActionRow
          icon={Building2}
          tone="bg-sky-100 text-sky-700"
          title="For business"
          subtitle="Catering, gifting, standing programs. Reply within one business day."
          asLink
          href="/business"
        />
      </div>
    </div>
  )
}

function ActionRow({
  icon: Icon,
  tone,
  title,
  subtitle,
  onClick,
  href,
  asLink,
  external,
}: {
  icon: React.ComponentType<{ className?: string }>
  tone: string
  title: string
  subtitle: string
  onClick?: () => void
  href?: string
  asLink?: boolean
  external?: boolean
}) {
  const inner = (
    <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-cream-100 transition-colors w-full text-left">
      <div className={cn('h-10 w-10 rounded-full inline-flex items-center justify-center shrink-0', tone)}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-cocoa-900 text-sm">{title}</div>
        <div className="text-xs text-cocoa-900/60 leading-relaxed mt-0.5 line-clamp-2">{subtitle}</div>
      </div>
      <ChevronRight className="h-4 w-4 text-cocoa-900/35 shrink-0" />
    </div>
  )

  if (asLink && href) {
    return (
      <Link
        href={href}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener' : undefined}
        className="block"
      >
        {inner}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} className="block w-full">
      {inner}
    </button>
  )
}

function FaqView() {
  return (
    <div className="p-5">
      <ul className="divide-y divide-cocoa-700/10">
        {WIDGET_FAQ.map((q) => (
          <li key={q.q}>
            <details className="group py-3">
              <summary className="cursor-pointer list-none flex items-start justify-between gap-3">
                <span className="font-medium text-cocoa-900 text-sm">{q.q}</span>
                <span className="text-sky-700 group-open:rotate-45 transition-transform shrink-0">+</span>
              </summary>
              <p className="mt-2 text-xs text-cocoa-900/75 leading-relaxed">{q.a}</p>
            </details>
          </li>
        ))}
      </ul>
      <div className="mt-5 text-xs text-cocoa-900/55">
        Still need help?{' '}
        <Link href="/chat" className="text-sky-700 hover:text-sky underline-offset-2 hover:underline">
          Chat with us →
        </Link>
      </div>
    </div>
  )
}

function CardFooter() {
  return (
    <div className="px-5 py-3 border-t border-cocoa-700/10 bg-cream-50 text-[11px] text-cocoa-900/55">
      We reply during open hours · Sugar Land, TX
    </div>
  )
}
