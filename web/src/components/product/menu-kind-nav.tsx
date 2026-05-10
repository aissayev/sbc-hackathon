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
      className="sticky top-[60px] z-10 -mx-4 md:mx-0 overflow-x-auto whitespace-nowrap bg-cream/85 backdrop-blur"
    >
      <ul className="inline-flex gap-1 p-1 my-2 rounded-full bg-cream-100 border border-cocoa-700/10">
        {KIND_ORDER.filter((k) => available.includes(k)).map((kind) => {
          const meta = KIND_LABELS[kind]
          return (
            <li key={kind}>
              <a
                href={`#${kind}`}
                className={cn(
                  'inline-flex items-center rounded-full px-4 h-9 text-sm font-medium transition-colors',
                  active === kind
                    ? 'bg-cocoa-700 text-cream shadow-sm'
                    : 'text-cocoa-900/75 hover:text-cocoa-900',
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
