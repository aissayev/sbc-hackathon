'use client'

import * as React from 'react'
import { ArrowRight, MessageSquareHeart, Search, Package, ChevronDown } from 'lucide-react'
import { TrackOrder } from './track-order'

export function HomeTab({ onAsk, onOpenHelp }: { onAsk: () => void; onOpenHelp: () => void }) {
  return (
    <div className="flex flex-col">
      <Hero />
      <div className="px-3 pb-4 space-y-2.5 -mt-4 relative z-10">
        <AskCard onAsk={onAsk} />
        <TrackCard />
        <SearchCard onOpenHelp={onOpenHelp} />
      </div>
    </div>
  )
}

// Coloured banner that fades into the body. Solid sky → sky-700 so it stays
// fully opaque (the previous /85 variant let page content bleed through on
// mobile). The greeting alone is the "brand" here — visitors already know
// whose widget they're in, so a wordmark on top would be visual noise.
function Hero() {
  return (
    <div className="relative bg-gradient-to-b from-sky to-sky-700 text-white px-5 pt-7 pb-14">
      <h2 className="font-display text-[26px] leading-tight">
        Hi <span aria-hidden>👋</span>
      </h2>
      <p className="mt-1 font-display text-[26px] leading-tight">
        How can we help today?
      </p>
    </div>
  )
}

function AskCard({ onAsk }: { onAsk: () => void }) {
  return (
    <button
      type="button"
      onClick={onAsk}
      className="w-full text-left rounded-2xl bg-bakery shadow-soft hover:shadow-lift border border-cocoa-700/8 p-4 flex items-center gap-3 transition-shadow"
    >
      <div className="h-11 w-11 rounded-full bg-sky/15 text-sky-700 inline-flex items-center justify-center shrink-0">
        <MessageSquareHeart className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-cocoa-900 text-sm">Ask a question</div>
        <div className="text-xs text-cocoa-900/60 leading-relaxed mt-0.5">
          Real cake people · usually under a minute
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-cocoa-900/40 shrink-0" />
    </button>
  )
}

// Track is a collapsible card so it doesn't dominate the home view; tapping
// the header toggles the live-polling form. Keeps the experience inside the
// widget — no navigation to /track/[code].
function TrackCard() {
  const [expanded, setExpanded] = React.useState(false)

  return (
    <div className="rounded-2xl bg-bakery shadow-soft border border-cocoa-700/8 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="w-full p-4 flex items-center gap-3 text-left hover:bg-cream-50 transition-colors"
      >
        <div className="h-11 w-11 rounded-full bg-emerald-100 text-emerald-700 inline-flex items-center justify-center shrink-0">
          <Package className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-cocoa-900 text-sm">Track your order</div>
          <div className="text-xs text-cocoa-900/60 leading-relaxed mt-0.5">
            Paste the order id, see live status.
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-cocoa-900/40 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      {expanded && (
        <div className="border-t border-cocoa-700/8 p-4 bg-cream-50">
          <TrackOrder />
        </div>
      )}
    </div>
  )
}

function SearchCard({ onOpenHelp }: { onOpenHelp: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpenHelp}
      className="w-full text-left rounded-2xl bg-bakery shadow-soft hover:shadow-lift border border-cocoa-700/8 p-4 flex items-center gap-3 transition-shadow"
    >
      <div className="h-11 w-11 rounded-full bg-cream-200 text-cocoa-700 inline-flex items-center justify-center shrink-0">
        <Search className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-cocoa-900 text-sm">Search for help</div>
        <div className="text-xs text-cocoa-900/60 leading-relaxed mt-0.5">
          Allergens, delivery, custom cakes, business
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-cocoa-900/40 shrink-0" />
    </button>
  )
}
