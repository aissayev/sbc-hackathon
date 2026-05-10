'use client'

// Press / podcast / YouTube card grid with rich previews.
//
//   YouTube → real video thumbnail (`i.ytimg.com/vi/<id>/hqdefault.jpg`)
//             with a play-button overlay; tapping opens an in-page lightbox
//             that lazy-mounts the youtube-nocookie iframe (no third-party
//             cookies until the customer hits play).
//   Press / podcast → the existing icon-led card with the outlet name and a
//             clean "Open ↗" affordance, since articles don't have a single
//             obvious thumbnail.
//
// The grid is used on /about ("We're in the media" band — the home page hands
// off into this) and on /press ("Watch" / "In the press" sections). Both
// surfaces share copy + interactivity so the customer reads the same cards
// regardless of where they land.

import * as React from 'react'
import { ExternalLink, Newspaper, Mic, Play, X } from 'lucide-react'
import type { Appearance } from '@/lib/press'
import { cn } from '@/lib/utils'

interface PressCardGridProps {
  items: Appearance[]
  /** When true, three columns at md+; otherwise two-column with bigger cards. */
  compact?: boolean
}

export function PressCardGrid({ items, compact = false }: PressCardGridProps) {
  // Lightbox state is local — opening a video sets the active id; closing
  // unsets it so the iframe is removed from the tree (and stops playing).
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const activeItem = items.find((i) => i.youtube_id === activeId) ?? null

  // ESC to close, click-outside to close. Body scroll-lock while open so
  // the page behind doesn't jiggle on iOS.
  React.useEffect(() => {
    if (!activeId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveId(null)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [activeId])

  return (
    <>
      <ul className={cn('grid gap-5', compact ? 'md:grid-cols-3' : 'md:grid-cols-2')}>
        {items.map((a) => (
          <li key={a.title}>
            {a.youtube_id ? (
              <YouTubeCard item={a} onPlay={() => setActiveId(a.youtube_id ?? null)} />
            ) : (
              <LinkCard item={a} />
            )}
          </li>
        ))}
      </ul>

      {activeItem?.youtube_id && (
        <Lightbox item={activeItem} onClose={() => setActiveId(null)} />
      )}
    </>
  )
}

// ─── YouTube card ──────────────────────────────────────────────────────
//
// The thumbnail comes from i.ytimg.com — same CDN every YouTube embed
// hits anyway, so loading it is free relative to the iframe. We try
// `maxresdefault.jpg` first (1280×720); if it 404s (uploader didn't set
// a HD thumb) we fall back to `hqdefault.jpg` (480×360, always present).
function YouTubeCard({ item, onPlay }: { item: Appearance; onPlay: () => void }) {
  const id = item.youtube_id!
  const [src, setSrc] = React.useState(`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`)
  return (
    <button
      type="button"
      onClick={onPlay}
      className="group bakery-card flex flex-col h-full p-0 overflow-hidden text-left w-full hover:-translate-y-0.5 transition-transform"
      aria-label={`Play video: ${item.title}`}
    >
      <div className="relative aspect-video bg-cocoa-900 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setSrc(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`)}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        {/* Play overlay — soft scrim + brand-coloured circle. The scrim
            stays light by default, deepens on hover so it reads as a
            press-able surface without screaming "DEMO VIDEO". */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/0 to-black/0 transition-opacity group-hover:from-black/45" />
        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center"
        >
          <span className="h-14 w-14 rounded-full bg-white/95 text-cocoa-900 shadow-lift flex items-center justify-center transition-transform group-hover:scale-110">
            <Play className="h-5 w-5 ml-0.5" fill="currentColor" />
          </span>
        </span>
        {/* Duration / channel chip in the corner — purely visual. */}
        <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-md bg-black/65 text-white text-[10px] font-medium uppercase tracking-[0.14em] px-2 py-0.5">
          YouTube
        </span>
      </div>
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-cocoa-900/55">
          <span>{item.outlet}</span>
          <span aria-hidden>·</span>
          <span>
            {new Date(item.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </span>
        </div>
        <h3 className="display-h3 mt-2 text-lg group-hover:text-sky-700 transition-colors [text-wrap:balance]">
          {item.title}
        </h3>
        <p className="mt-2 text-sm text-cocoa-900/70 leading-relaxed line-clamp-3">
          {item.description}
        </p>
        <span className="mt-3 inline-flex items-center gap-1 text-xs text-sky-700 font-medium">
          <Play className="h-3 w-3" fill="currentColor" /> Play in place
        </span>
      </div>
    </button>
  )
}

// ─── Press / podcast card ─────────────────────────────────────────────

function LinkCard({ item }: { item: Appearance }) {
  const Icon = item.type === 'podcast' ? Mic : Newspaper
  const tone = item.type === 'podcast' ? 'bg-cream-200 text-cocoa-700' : 'bg-sky/10 text-sky-700'
  const Wrapper = item.url ? 'a' : 'div'
  const linkProps = item.url ? { href: item.url, target: '_blank', rel: 'noopener' } : {}
  return (
    <Wrapper
      {...linkProps}
      className="group bakery-card flex flex-col h-full p-5 hover:-translate-y-0.5 transition-transform"
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'h-10 w-10 rounded-full inline-flex items-center justify-center shrink-0',
            tone,
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.16em] text-cocoa-900/55 truncate">
            {item.outlet}
          </div>
          <div className="text-xs text-cocoa-900/55">
            {new Date(item.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </div>
        </div>
      </div>
      <h3 className="display-h3 mt-4 text-lg group-hover:text-sky-700 transition-colors [text-wrap:balance]">
        {item.title}
      </h3>
      <p className="mt-2 text-sm text-cocoa-900/70 leading-relaxed line-clamp-3">
        {item.description}
      </p>
      {item.url && (
        <span className="mt-3 inline-flex items-center gap-1 text-xs text-sky-700">
          Open <ExternalLink className="h-3 w-3" />
        </span>
      )}
    </Wrapper>
  )
}

// ─── Lightbox ─────────────────────────────────────────────────────────

function Lightbox({ item, onClose }: { item: Appearance; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close video"
          className="absolute -top-10 right-0 inline-flex items-center gap-1.5 text-white/90 hover:text-white text-sm"
        >
          <X className="h-4 w-4" /> Close
        </button>
        <div className="relative aspect-video bg-black rounded-2xl overflow-hidden shadow-lift">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${item.youtube_id}?autoplay=1&rel=0`}
            title={item.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        </div>
        <div className="mt-3 text-white/85 text-sm flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.16em] text-white/55">
            {item.outlet}
          </span>
          <span aria-hidden className="text-white/35">·</span>
          <span className="font-medium">{item.title}</span>
        </div>
      </div>
    </div>
  )
}
