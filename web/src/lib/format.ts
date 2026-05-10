// Display helpers for prices, lead times, dates. Centralised so that the
// brand voice (specific quantities, plain English) is consistent everywhere.

export function fmtUsd(cents: number): string {
  const dollars = cents / 100
  return `$${dollars.toFixed(2).replace(/\.00$/, '')}`
}

export function leadTimeLabel(hours: number): string {
  if (hours < 1) return 'Right now from the case'
  if (hours === 1) return 'About an hour'
  if (hours < 24) return `${hours} hours notice`
  const days = Math.round(hours / 24)
  return `${days} day${days > 1 ? 's' : ''} notice`
}

export function fmtRelativeDate(iso: string | number | Date): string {
  const d = new Date(iso)
  const now = new Date()
  const diffH = (d.getTime() - now.getTime()) / 36e5
  if (Math.abs(diffH) < 1) return 'within the hour'
  if (diffH < 0 && diffH > -24) return `${Math.round(-diffH)}h ago`
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// Cake-name display per BRANDBOOK §2: cake "Honey", cake "Pistachio Roll".
// Applies the "cake-name in quotes after the word cake" pattern when the
// product name doesn't already contain the word "cake".
export function brandCakeName(name: string): string {
  const cleaned = name.replace(/\s*\((slice|whole)\)\s*/i, '').trim()
  if (/\bcake\b/i.test(cleaned)) return cleaned
  return `cake "${cleaned}"`
}

// Single source of truth for how an order id is shown in the UI.
//
// The full id is `ord_<13-digit-ms>_<6-char-base36>` — 24 chars. Showing
// just the trailing slice (e.g. `#4_UG4G4J`) used to seem prettier, but
// caused customers to paste truncated values into chat / track that the
// backend's strict `WHERE id = ?` lookup couldn't match. The backend is
// now suffix-tolerant (src/domain/tools.ts:getOrderStatus), but the
// long-term fix is: SHOW THE FULL ID anywhere a customer might copy it.
//
// Variants:
//   `full`   — entire `ord_<ms>_<rand>` string. Use anywhere a customer
//              might copy the value to look it up later (confirmation
//              page, tracker, chat-widget order card, B2B inquiry sent).
//   `short`  — `…<last 6>` for owner-only table compactness (admin
//              tables / lists). The leading `…` makes truncation
//              obvious so nobody mistakes it for a complete id.
export function formatOrderId(id: string, variant: 'full' | 'short' = 'full'): string {
  if (variant === 'full') return id
  // Tail of the random suffix only — owner already has the full id in the
  // row's anchor URL, so this is purely a visual handle.
  return `…${id.slice(-6)}`
}
