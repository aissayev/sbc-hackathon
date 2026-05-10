// Post-order context: did the customer submit during open hours? Will the
// kitchen actually start now, or sit until tomorrow? Does this product need
// a long lead time? The order tracker reads this so the customer doesn't
// stare at "Order received" and wonder if anyone is awake.
//
// Pure: no react, no fetches. The component layer composes the strings.

import { CATALOG, findCatalogProduct } from './catalog'
import { isOpenAt, hoursLabelForDay, nextOpenDate } from './hours'

export type OrderEtaTone = 'open' | 'closed' | 'lead-time'

export interface OrderEtaContext {
  /** What kind of situation is this — drives the badge styling. */
  tone: OrderEtaTone
  /** Headline for the banner, ≤ 60 chars. Brand-voice: specific, plain. */
  headline: string
  /** Sub-line under the headline. ≤ 140 chars. Optional. */
  detail?: string
  /** Max lead time across all line items, in hours. 0 if none required. */
  maxLeadHours: number
  /** True iff the order was placed while the shop was closed. */
  placedAfterHours: boolean
}

interface EtaInput {
  items?: Array<{ sku: string; qty: number }> | null
  scheduled_at?: string | null
  requires_approval?: boolean
}

// Look up lead-time per item from the canonical catalog. Order rows don't
// carry lead_time_hours (they were captured at draft time and may have
// changed since). The catalog is the source of truth.
function maxLeadFromItems(items: EtaInput['items']): number {
  if (!items || items.length === 0) return 0
  let max = 0
  for (const it of items) {
    const product = findCatalogProduct(it.sku)
    const lead = product?.lead_time_hours ?? 0
    if (lead > max) max = lead
  }
  return max
}

function formatHumanLeadTime(hours: number): string {
  if (hours <= 0) return 'no notice'
  if (hours < 1) return 'about 30 minutes'
  if (hours === 1) return 'about an hour'
  if (hours < 24) return `${hours} hours`
  const days = Math.round(hours / 24)
  return `${days} day${days > 1 ? 's' : ''}`
}

function formatScheduled(iso: string, now: Date): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'soon'
  const sameDay = d.toDateString() === now.toDateString()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const isTomorrow = d.toDateString() === tomorrow.toDateString()
  const time = d.toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  if (sameDay) return `today at ${time}`
  if (isTomorrow) return `tomorrow at ${time}`
  return d.toLocaleString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/**
 * Compute the post-order banner for a fresh order. Three branches:
 *
 *   1. Closed at submit time
 *      → "It's after hours — we're closed right now."
 *      → "The kitchen picks this up at <next open>. Earliest ready
 *         around <scheduled_at | next open + lead>."
 *
 *   2. Long lead time required (≥ 3 hours)
 *      → "Heads up — this needs about <N hours> notice."
 *      → "Earliest ready around <scheduled_at>." OR
 *        "We'll have it ready around <scheduled_at>."
 *
 *   3. Open + short lead OR no lead concerns
 *      → null sub-context — caller renders the existing inline ETA.
 *
 * Custom / catering orders that require team review override (1) and (2)
 * with a softer "the team will look at this within the hour" line, since
 * the kitchen doesn't actually start until approval.
 */
export function computeOrderEta(order: EtaInput, now: Date = new Date()): OrderEtaContext {
  const maxLeadHours = maxLeadFromItems(order.items ?? null)
  const open = isOpenAt(now)
  const placedAfterHours = !open

  // Custom / catering: the team has to eyeball this before the kitchen
  // starts. Lead time math is moot — the bottleneck is human review, and
  // we already promise an hour. We still surface "after hours" so the
  // customer knows there might be a longer wait overnight.
  if (order.requires_approval) {
    if (placedAfterHours) {
      const next = nextOpenDateFormatted(now)
      return {
        tone: 'closed',
        headline: "We're closed right now — the team will reply when we're back.",
        detail: `Custom and catering orders get a personal review. Expect a reply ${next}.`,
        maxLeadHours,
        placedAfterHours,
      }
    }
    return {
      tone: 'lead-time',
      headline: 'Custom order — our team is reviewing.',
      detail:
        'We design custom and catering orders by hand. Expect a reply within the hour during open hours.',
      maxLeadHours,
      placedAfterHours,
    }
  }

  // Standard catalog: kitchen auto-starts. The two failure modes are
  // (a) we're closed so the kitchen sits, (b) the cake itself needs hours
  // of notice (whole cakes, catering trays).
  if (placedAfterHours) {
    const next = nextOpenDateFormatted(now)
    const ready = order.scheduled_at
      ? formatScheduled(order.scheduled_at, now)
      : `${next} once we open`
    return {
      tone: 'closed',
      headline: "It's after hours — we'll start first thing in the morning.",
      detail: `Our kitchen picks this up ${next}. Ready around ${ready}.`,
      maxLeadHours,
      placedAfterHours,
    }
  }

  if (maxLeadHours >= 3) {
    const ready = order.scheduled_at
      ? formatScheduled(order.scheduled_at, now)
      : `in about ${formatHumanLeadTime(maxLeadHours)}`
    return {
      tone: 'lead-time',
      headline: `Heads up — this needs about ${formatHumanLeadTime(maxLeadHours)} of notice.`,
      detail: `We'll have it ready ${ready}.`,
      maxLeadHours,
      placedAfterHours,
    }
  }

  // Normal path: open, short lead. Caller falls back to the inline ETA.
  return {
    tone: 'open',
    headline: 'On it — the kitchen has the ticket.',
    detail: order.scheduled_at
      ? `Ready ${formatScheduled(order.scheduled_at, now)}.`
      : "We'll text you the moment it's ready.",
    maxLeadHours,
    placedAfterHours,
  }
}

// "tomorrow at 11 AM" / "Sunday at 12 PM" — short phrase that drops into
// "the team will reply when we're back" / "ready around <here>".
function nextOpenDateFormatted(now: Date): string {
  // Walk from tomorrow forward (we're closed now, so the same day is moot
  // unless it's pre-open; we still treat "later today" specially).
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)

  // First check if today still has an open window in the future (shop
  // closed because too early). The hours-grid uses static spec; we can
  // peek by combining today's date with the spec's open time.
  const todayLabel = hoursLabelForDay(now)
  if (todayLabel !== 'Closed') {
    const openTime = todayLabel.split(/[–-]/)[0].trim()
    const [hh, ampm] = openTime.split(' ')
    const [h] = hh.split(':').map(Number)
    let hour = h % 12
    if (ampm === 'PM') hour += 12
    if (now.getHours() < hour) {
      return `today at ${openTime}`
    }
  }

  const next = nextOpenDate(tomorrow)
  if (!next) return 'when we open next'
  const sameAsTomorrow = next.toDateString() === tomorrow.toDateString()
  const open = hoursLabelForDay(next).split(/[–-]/)[0].trim()
  const dayLabel = sameAsTomorrow
    ? 'tomorrow'
    : next.toLocaleDateString('en-US', { weekday: 'long' })
  return `${dayLabel} at ${open}`
}

// Re-export for callers that want a fast "are we open right now" without
// pulling order-eta in. (Cheap re-export — keeps the import surface tidy
// for components that already use this module.)
export { isOpenAt }

// Catalog re-export so the order page doesn't need to know that order-eta
// itself is what's looking up lead times. Useful if we ever want to add a
// "this product takes 24h" callout per line item.
export { CATALOG }
