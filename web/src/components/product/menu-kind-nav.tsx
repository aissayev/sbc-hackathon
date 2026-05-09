'use client'

import * as React from 'react'
import { KIND_LABELS, KIND_ORDER, type ProductKind } from '@/lib/catalog'
import { cn } from '@/lib/utils'

// Sticky in-page jump bar. Tapping a kind smooth-scrolls to the section
// (server-rendered with id={kind}). The active state is derived from
// IntersectionObserver so the chip you're reading lights up as you scroll.

export function MenuKindNav({ available }: { available: ProductKind[] }) {
  const [active, setActive] = React.useState<ProductKind | null>(available[0] ?? null)

  React.useEffect(() => {
    const sections = available
      .map((kind) => document.getElementById(kind))
      .filter((el): el is HTMLElement => el !== null)
    if (sections.length === 0) return
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible) setActive(visible.target.id as ProductKind)
      },
      { rootMargin: '-30% 0px -55% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] },
    )
    sections.forEach((s) => obs.observe(s))
    return () => obs.disconnect()
  }, [available])

  return (
    <nav
      aria-label="Menu sections"
      className="sticky top-[68px] z-10 -mx-4 md:mx-0 overflow-x-auto whitespace-nowrap bg-cream/85 backdrop-blur border-y border-cocoa-700/8"
    >
      <ul className="flex gap-2 px-4 md:px-0 py-2">
        {KIND_ORDER.filter((k) => available.includes(k)).map((kind) => {
          const meta = KIND_LABELS[kind]
          return (
            <li key={kind}>
              <a
                href={`#${kind}`}
                className={cn(
                  'inline-flex items-center rounded-full px-4 h-9 text-sm font-medium transition-colors border',
                  active === kind
                    ? 'bg-cocoa-700 text-cream-50 border-cocoa-700'
                    : 'bg-white border-cocoa-700/15 text-cocoa-900 hover:bg-cream-100',
                )}
              >
                {meta.plural}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
