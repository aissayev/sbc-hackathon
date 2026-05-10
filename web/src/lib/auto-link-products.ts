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

// Detect which catalog products are mentioned in a piece of text. Used by
// the chat bubble to attach a small photo card per product so the customer
// sees the cake the agent is talking about — no hunting in the menu.
//
// Same match policy as autoLinkProducts (whole-word, case-insensitive,
// dedup by id, longest-first to avoid double-counting "Whole Honey Cake"
// + "Honey Cake"). Returns at most 3 — chat bubbles are not a gallery.
export interface ProductMention {
  id: string
  name: string
  href: string
  photo_url: string | null
  price_cents: number
}

const MENTION_REFS = CATALOG
  .map((p) => ({
    id: p.id, name: p.name, href: `/menu/${p.id}`,
    photo_url: p.photo_url, price_cents: p.price_cents,
  }))
  .sort((a, b) => b.name.length - a.name.length)

export function findProductMentions(text: string, max = 3): ProductMention[] {
  if (!text) return []
  // Split-on-preserve so we ignore matches inside an existing markdown
  // link target (otherwise `/menu/honey-cake-slice` matches "honey").
  const segments = text.split(PRESERVE_RE).filter((_, i) => i % 2 === 0)
  const haystack = segments.join(' ')
  const found = new Map<string, ProductMention>()
  for (const ref of MENTION_REFS) {
    if (found.size >= max) break
    if (found.has(ref.id)) continue
    const re = new RegExp(`\\b${escapeRegExp(ref.name)}\\b`, 'i')
    if (re.test(haystack)) found.set(ref.id, ref)
  }
  return Array.from(found.values())
}
