import { CATALOG } from './catalog'

// Wrap product mentions in markdown links so the chat bubble's markdown
// renderer turns them into clickable jumps to the product detail page.
//
// Match policy:
//   - Whole-word, case-insensitive ("Honey Cake", "honey cake")
//   - Skip text that's already inside a markdown link (avoids re-wrapping)
//   - Longer names matched first ("Whole Honey Cake" before "Honey Cake")
//
// We scan once per assistant message — the catalog has 10 items, so the
// linear pass is trivially cheap. If/when the catalog grows past a few
// dozen items, swap in a single combined regex.

interface ProductRef {
  name: string
  href: string
}

const REFS: ProductRef[] = CATALOG
  .map((p) => ({ name: p.name, href: `/menu/${p.id}` }))
  // Longest first so "Whole Honey Cake" wins over "Honey Cake" on overlap.
  .sort((a, b) => b.name.length - a.name.length)

// Already-linked spans (markdown `[label](url)` and bare URLs) are
// left alone. We split on those, transform the text-only pieces, and
// rejoin.
const PRESERVE_RE = /(\[[^\]]+\]\((?:https?:\/\/|\/)[^)]+\)|https?:\/\/[^\s)]+)/g

export function autoLinkProducts(text: string): string {
  if (!text) return text
  return text
    .split(PRESERVE_RE)
    .map((segment, i) => {
      // Even indices are plain text; odd are preserved markdown / URLs.
      if (i % 2 === 1) return segment
      return linkSegment(segment)
    })
    .join('')
}

function linkSegment(segment: string): string {
  let out = segment
  for (const ref of REFS) {
    // \b is ASCII-only but our names are all ASCII; works fine.
    const re = new RegExp(`\\b(${escapeRegExp(ref.name)})\\b`, 'gi')
    let replaced = false
    out = out.replace(re, (match) => {
      if (replaced) return match // only link the first mention per message
      replaced = true
      return `[${match}](${ref.href})`
    })
  }
  return out
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
