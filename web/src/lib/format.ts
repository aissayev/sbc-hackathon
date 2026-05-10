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

// Tighter than fmtRelativeDate — for inbox rows where "3m ago" is more
// useful than "within the hour". Falls through to a date for anything
// older than a week.
export function fmtRelativeTime(input: string | number | Date): string {
  const t = new Date(input).getTime()
  if (!Number.isFinite(t) || t === 0) return '—'
  const diffMs = Date.now() - t
  const sec = Math.round(diffMs / 1000)
  if (sec < 30) return 'just now'
  if (sec < 60) return `${sec}s ago`
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.round(hr / 24)
  if (day < 7) return `${day}d ago`
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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
// The canonical id is `ord_<13-digit-ms>_<6-char-base36>` — 24 chars —
// and that's what the backend uses internally (paired with `square_order_id`
// for Square reconciliation). The friendly alias `HC-1042` is a customer-
// facing label derived from SQLite ROWID; we now prefer it anywhere a
// human would read the id back. The backend's lookup accepts both forms.
//
// Variants:
//   `full`   — entire `ord_<ms>_<rand>` string. Use only where the value
//              must round-trip to a system that doesn't accept the
//              friendly alias (rare).
//   `short`  — `…<last 6>` for owner-only table compactness when no
//              friendly id is available. The leading `…` makes truncation
//              obvious so nobody mistakes it for a complete id.
export function formatOrderId(id: string, variant: 'full' | 'short' = 'full'): string {
  if (variant === 'full') return id
  return `…${id.slice(-6)}`
}

// Customer-facing display label. Prefers the friendly alias (`HC-1042`);
// falls back to the long id formatter for older payloads or admin
// contexts where the alias isn't populated. Always pass the whole
// order-like object so the helper can pick the best label.
export function displayOrderId(
  order: { id: string; friendly_id?: string | null },
  fallbackVariant: 'full' | 'short' = 'full',
): string {
  if (order.friendly_id) return order.friendly_id
  return formatOrderId(order.id, fallbackVariant)
}
