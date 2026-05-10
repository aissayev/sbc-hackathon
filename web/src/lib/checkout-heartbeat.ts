// Browser-side heartbeat for the checkout funnel. The OrderForm wizard
// fires this on every step entry + on successful submission, which the
// backend uses to track abandoned carts (see src/domain/checkouts.ts).
//
// Best-effort only — failures are swallowed so a flaky network never
// blocks the customer. The data shape mirrors heartbeatSchema on the
// server.

import { CATALOG, findCatalogProduct } from './catalog'

const SESSION_KEY = 'hc_checkout_session_id'

// Generate (or recover) the session id for this browser visit. Stored
// in sessionStorage — survives within-tab navigation but resets when
// the customer closes the tab, which is what we want: a fresh funnel
// per visit. localStorage'd thread id stays stable across sessions
// for cross-visit attribution.
export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return `co_ssr_${Math.random().toString(36).slice(2, 8)}`
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY)
    if (existing) return existing
    const fresh = `co_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    window.sessionStorage.setItem(SESSION_KEY, fresh)
    return fresh
  } catch {
    return `co_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  }
}

// Reset the session id — called after a successful submission so the
// next /order visit starts a fresh funnel rather than reactivating the
// just-submitted row.
export function resetSession() {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(SESSION_KEY)
  } catch {}
}

export type HeartbeatStep = 'cakes' | 'when' | 'contact' | 'payment' | 'submitted'

interface ItemLike {
  product_id: string
  quantity: number | string
}

export interface HeartbeatPayload {
  step: HeartbeatStep
  items: ItemLike[]
  thread_id: string
  customer_name?: string
  customer_email?: string
  customer_phone?: string
  pickup_or_delivery?: 'pickup' | 'delivery'
  scheduled_at?: string
  referral_source?: string
  order_id?: string
}

/**
 * Fire-and-forget POST to /api/checkout/heartbeat. Catches all errors
 * so the wizard never sees them. Only enqueues if there's something
 * useful to send (skips empty carts on the very first cakes-step
 * heartbeat to avoid creating a row for someone who just opened the
 * page and bounced).
 */
export function sendHeartbeat(payload: HeartbeatPayload): void {
  if (typeof window === 'undefined') return
  // Compute total + enrich items with name/price from the canonical
  // catalog so the server doesn't have to look the SKU up itself.
  const items = payload.items
    .map((it) => {
      const qty = Number(it.quantity)
      const product = findCatalogProduct(it.product_id) ?? CATALOG.find((p) => p.id === it.product_id)
      if (!product || !Number.isFinite(qty) || qty <= 0) return null
      return {
        product_id: product.id,
        quantity: Math.floor(qty),
        name: product.name,
        price_cents: product.price_cents,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
  const total_cents = items.reduce((acc, it) => acc + it.price_cents * it.quantity, 0)

  // First-step heartbeat with empty cart? Skip — no point creating a
  // row for "they opened the page and left" since that's not a real
  // checkout intent yet.
  if (payload.step === 'cakes' && items.length === 0) return

  const body = {
    session_id: getOrCreateSessionId(),
    thread_id: payload.thread_id,
    step: payload.step,
    items,
    total_cents,
    customer_name: payload.customer_name?.trim() || undefined,
    customer_email: payload.customer_email?.trim() || undefined,
    customer_phone: payload.customer_phone?.trim() || undefined,
    pickup_or_delivery: payload.pickup_or_delivery,
    scheduled_at: payload.scheduled_at,
    referral_source: payload.referral_source,
    order_id: payload.order_id,
  }

  // Fire-and-forget. Use sendBeacon when available so the request
  // survives a page-unload (customer navigates away mid-checkout) —
  // that's the "abandoned" signal we most want to capture.
  try {
    if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator && payload.step === 'submitted') {
      // Plain JSON via sendBeacon needs a Blob with the right content-type.
      const blob = new Blob([JSON.stringify(body)], { type: 'application/json' })
      const queued = navigator.sendBeacon('/api/checkout/heartbeat', blob)
      if (queued) return
    }
    // Default path: regular fetch. keepalive lets the browser flush
    // even if the page is unloading; explicitly NOT awaited.
    void fetch('/api/checkout/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {})
  } catch {
    // Total failure (rare): swallow. We don't want a heartbeat error
    // to ever surface to the customer.
  }
}
