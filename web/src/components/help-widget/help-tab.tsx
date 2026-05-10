'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  ChevronLeft,
  ChevronRight,
  Search as SearchIcon,
  Package,
  ShieldAlert,
  Truck,
  Sparkles,
  Building2,
  CreditCard,
  ArrowUpRight,
} from 'lucide-react'
import { WIDGET_COLLECTIONS, type WidgetCollection, type WidgetFaq } from '@/lib/widget'
import { cn } from '@/lib/utils'

const ICONS: Record<WidgetCollection['icon'], React.ComponentType<{ className?: string }>> = {
  package: Package,
  allergens: ShieldAlert,
  truck: Truck,
  sparkles: Sparkles,
  building: Building2,
  card: CreditCard,
}

const TONES: Record<WidgetCollection['icon'], string> = {
  package: 'bg-sky-100 text-sky-700',
  allergens: 'bg-amber-100 text-amber-700',
  truck: 'bg-emerald-100 text-emerald-700',
  sparkles: 'bg-berry-100 text-berry',
  building: 'bg-indigo-100 text-indigo-700',
  card: 'bg-cream-200 text-cocoa-700',
}

export function HelpTab({
  collectionId,
  onOpenCollection,
  onBack,
  onAsk,
}: {
  collectionId: string | null
  onOpenCollection: (id: string) => void
  onBack: () => void
  onAsk: () => void
}) {
  if (collectionId) {
    const collection = WIDGET_COLLECTIONS.find((c) => c.id === collectionId)
    if (!collection) return <CollectionList onOpen={onOpenCollection} onAsk={onAsk} />
    return <CollectionDetail collection={collection} onBack={onBack} onAsk={onAsk} />
  }
  return <CollectionList onOpen={onOpenCollection} onAsk={onAsk} />
}

function CollectionList({ onOpen, onAsk }: { onOpen: (id: string) => void; onAsk: () => void }) {
  const [query, setQuery] = React.useState('')
  const trimmed = query.trim().toLowerCase()

  // Search across collection titles AND embedded FAQ questions so the user
  // can type "halal" or "delivery" and surface the right collection.
  const filtered = trimmed
    ? WIDGET_COLLECTIONS.filter((c) => {
        if (c.title.toLowerCase().includes(trimmed)) return true
        if (c.description.toLowerCase().includes(trimmed)) return true
        return c.faqs.some(
          (f) => f.q.toLowerCase().includes(trimmed) || f.a.toLowerCase().includes(trimmed),
        )
      })
    : WIDGET_COLLECTIONS

  return (
    <div className="flex flex-col">
      <div className="px-4 pt-4 pb-3 sticky top-0 bg-bakery z-10">
        <h2 className="font-display text-xl text-cocoa-900">Help</h2>
        <div className="mt-3 relative">
          <SearchIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-cocoa-900/45" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for help"
            aria-label="Search help"
            className="w-full h-10 pl-9 pr-3 rounded-full bg-cream-100 border border-cocoa-700/10 text-sm placeholder:text-cocoa-900/45 focus:outline-none focus:ring-2 focus:ring-sky/40"
          />
        </div>
      </div>
      <div className="px-2 pb-4">
        <p className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-[0.14em] text-cocoa-900/55 font-medium">
          {trimmed ? `${filtered.length} match${filtered.length === 1 ? '' : 'es'}` : `${WIDGET_COLLECTIONS.length} collections`}
        </p>
        {filtered.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-cocoa-900/65">
            No matches. Try{' '}
            <button
              type="button"
              onClick={onAsk}
              className="text-sky-700 hover:text-sky underline-offset-2 hover:underline"
            >
              asking us directly
            </button>
            .
          </div>
        ) : (
          <ul className="divide-y divide-cocoa-700/8">
            {filtered.map((c) => (
              <li key={c.id}>
                <CollectionRow collection={c} onOpen={() => onOpen(c.id)} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function CollectionRow({ collection, onOpen }: { collection: WidgetCollection; onOpen: () => void }) {
  const Icon = ICONS[collection.icon]
  const tone = TONES[collection.icon]
  const meta = collection.cta
    ? collection.cta.subtitle ?? 'Quick action'
    : `${collection.faqs.length} ${collection.faqs.length === 1 ? 'article' : 'articles'}`
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full flex items-start gap-3 px-3 py-3.5 text-left hover:bg-cream-100 rounded-lg transition-colors"
    >
      <div className={cn('h-10 w-10 rounded-full inline-flex items-center justify-center shrink-0', tone)}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-cocoa-900 text-sm">{collection.title}</div>
        <div className="text-xs text-cocoa-900/60 leading-relaxed mt-0.5 line-clamp-2">
          {collection.description}
        </div>
        <div className="text-[11px] text-cocoa-900/45 mt-1">{meta}</div>
      </div>
      <ChevronRight className="h-4 w-4 text-cocoa-900/35 shrink-0 mt-1" />
    </button>
  )
}

function CollectionDetail({
  collection,
  onBack,
  onAsk,
}: {
  collection: WidgetCollection
  onBack: () => void
  onAsk: () => void
}) {
  const Icon = ICONS[collection.icon]
  const tone = TONES[collection.icon]
  return (
    <div className="flex flex-col">
      <div className="px-4 pt-4 pb-3 border-b border-cocoa-700/8 sticky top-0 bg-bakery z-10">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-sky-700 hover:text-sky inline-flex items-center gap-1"
        >
          <ChevronLeft className="h-4 w-4" /> All collections
        </button>
        <div className="mt-3 flex items-start gap-3">
          <div className={cn('h-10 w-10 rounded-full inline-flex items-center justify-center shrink-0', tone)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-lg text-cocoa-900 leading-tight">{collection.title}</h2>
            <p className="text-xs text-cocoa-900/65 leading-relaxed mt-1">{collection.description}</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {collection.cta && <CtaBlock cta={collection.cta} />}
        {collection.faqs.length > 0 && (
          <ul className="divide-y divide-cocoa-700/10 rounded-2xl border border-cocoa-700/10 bg-bakery">
            {collection.faqs.map((q) => (
              <li key={q.q}>
                <FaqItem faq={q} />
              </li>
            ))}
          </ul>
        )}
        <div className="pt-2 text-xs text-cocoa-900/55">
          Still need help?{' '}
          <button
            type="button"
            onClick={onAsk}
            className="text-sky-700 hover:text-sky underline-offset-2 hover:underline"
          >
            Chat with us →
          </button>
        </div>
      </div>
    </div>
  )
}

function CtaBlock({ cta }: { cta: NonNullable<WidgetCollection['cta']> }) {
  return (
    <Link
      href={cta.href}
      className="block rounded-2xl bg-cocoa-900 text-cream p-4 hover:bg-cocoa-700 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm">{cta.label}</div>
          {cta.subtitle && <div className="text-xs text-cream/70 mt-0.5">{cta.subtitle}</div>}
        </div>
        <ArrowUpRight className="h-4 w-4 text-cream/80 shrink-0" />
      </div>
    </Link>
  )
}

function FaqItem({ faq }: { faq: WidgetFaq }) {
  return (
    <details className="group">
      <summary className="cursor-pointer list-none flex items-start justify-between gap-3 px-4 py-3.5 hover:bg-cream-50">
        <span className="font-medium text-cocoa-900 text-sm leading-snug">{faq.q}</span>
        <span className="text-sky-700 group-open:rotate-45 transition-transform shrink-0 mt-0.5">+</span>
      </summary>
      <p className="px-4 pb-4 text-xs text-cocoa-900/75 leading-relaxed">{faq.a}</p>
    </details>
  )
}
