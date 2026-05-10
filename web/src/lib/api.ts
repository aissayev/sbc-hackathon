// Server-side data fetcher. Talks to the Hono backend at BACKEND_URL.
//
// Catalog policy: the website's source of truth for `listProducts` /
// `getProduct` is `lib/catalog.ts` — the canonical Happy Cake product list
// paired with approved photos. The backend's SQLite seed currently has
// generic placeholder SKUs (sku-classic-1kg, etc.); ignoring it for the
// menu surface is intentional. We still call the backend for live signals
// (in_stock toggling, daily counts) once those land — see TODO below.
//
// All other endpoints (orders, chat, admin) go through the backend as the
// system of record.

import { CATALOG, findCatalogProduct } from './catalog'

export interface Product {
  id: string
  name: string
  // Drives /menu's section grouping (By the slice / Whole cakes / Pastries /
  // Custom / Catering). Backend's Square catalog doesn't carry this yet, so
  // products from the backend default to 'slice' until lib/catalog.ts is the
  // source of truth.
  kind: 'slice' | 'whole' | 'pastry' | 'custom' | 'catering'
  category: string
  price_cents: number
  lead_time_hours: number
  allergens: string | null
  description: string | null
  photo_url: string | null
  in_stock: number
  daily_capacity: number | null
}

export interface OrderItem {
  sku: string
  qty: number
  unit_cents: number
  line_total_cents: number
  name: string
}

export interface OrderStatus {
  id: string
  status: string
  total_cents: number
  scheduled_at: string | null
  customer_name: string | null
  pickup_or_delivery: 'pickup' | 'delivery'
  items?: OrderItem[]
  kitchen_ticket_id?: string | null
}

export interface DailyReport {
  date: string
  orders_count: number
  revenue_cents: number
  pending_approval: number
  escalations_open: number
}

const BACKEND =
  process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3000'

// Server-only — never exposed to the browser. When set, paired with the same
// value in the backend's WEB_BACKEND_SECRET, it authenticates Next.js SSR
// against /api/admin/* without requiring Mini App init-data. Browser-side
// code authenticates separately via X-Telegram-Init-Data (see TgAppProvider).
const BACKEND_SECRET = process.env.WEB_BACKEND_SECRET

function withBackendSecret(init: RequestInit | undefined, url: string): RequestInit {
  if (!BACKEND_SECRET) return init ?? {}
  if (!url.includes('/api/admin/')) return init ?? {}
  const headers = new Headers(init?.headers)
  headers.set('X-Backend-Secret', BACKEND_SECRET)
  return { ...init, headers }
}

async function safeFetch<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, {
      ...withBackendSecret(init, url),
      next: { revalidate: process.env.NODE_ENV === 'production' ? 60 : 0 },
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

// Catalog read path:
//   The canonical menu is `lib/catalog.ts`. Backend endpoints (`/api/catalog`
//   newer MCP-mirrored snapshot, `/api/products` legacy) are used only for
//   *live signals* (in_stock toggling, daily_capacity) layered onto canonical
//   items by id. Items the backend doesn't know about stay visible from the
//   local seed; placeholder backend SKUs that don't match any local id are
//   ignored — they're stale rows that shadowed the real catalog before this
//   defensive layer was added. The typed `kind` axis (slice / whole /
//   pastry / custom / catering) always comes from the local catalog.
type LiveSignal = { in_stock?: number; daily_capacity?: number | null }

async function fetchLiveSignals(): Promise<Map<string, LiveSignal> | null> {
  // Prefer /api/catalog (newer MCP-mirrored). Fall back to /api/products if
  // the deploy hasn't picked it up yet. Both return {products: [...]} with
  // id/in_stock/daily_capacity.
  const fresh = await safeFetch<{ products: Array<{ id: string } & LiveSignal> }>(
    `${BACKEND}/api/catalog`,
  )
  const products = fresh?.products?.length
    ? fresh.products
    : (await safeFetch<{ products: Array<{ id: string } & LiveSignal> }>(`${BACKEND}/api/products`))
        ?.products
  if (!products?.length) return null
  const out = new Map<string, LiveSignal>()
  for (const p of products) {
    if (!findCatalogProduct(p.id)) continue
    out.set(p.id, { in_stock: p.in_stock, daily_capacity: p.daily_capacity })
  }
  return out
}

export async function listProducts(): Promise<Product[]> {
  const live = await fetchLiveSignals()
  return CATALOG
    .map((p) => {
      const sig = live?.get(p.id)
      if (!sig) return p
      return {
        ...p,
        in_stock: sig.in_stock ?? p.in_stock,
        daily_capacity: sig.daily_capacity ?? p.daily_capacity,
      }
    })
    .filter((p) => p.in_stock)
}

export async function getProduct(id: string): Promise<Product | null> {
  const local = findCatalogProduct(id)
  if (!local) return null
  const live = await safeFetch<LiveSignal & { id?: string }>(
    `${BACKEND}/api/products/${encodeURIComponent(id)}`,
  )
  if (!live) return local
  return {
    ...local,
    in_stock: live.in_stock ?? local.in_stock,
    daily_capacity: live.daily_capacity ?? local.daily_capacity,
  }
}

export async function getOrder(id: string): Promise<OrderStatus | null> {
  return safeFetch<OrderStatus>(`${BACKEND}/api/orders/${encodeURIComponent(id)}`)
}

export interface DraftOrderInput {
  items: Array<{ product_id: string; quantity: number }>
  scheduled_at_iso?: string
  customer_name?: string
  customer_phone?: string
  pickup_or_delivery?: 'pickup' | 'delivery'
  notes?: string
}

export interface DraftOrderResult {
  ok: boolean
  order_id?: string
  total_cents?: number
  reason?: string
}

export async function createDraftOrder(input: DraftOrderInput): Promise<DraftOrderResult> {
  try {
    const res = await fetch(`${BACKEND}/api/orders/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, channel: 'web' }),
      cache: 'no-store',
    })
    const data = (await res.json()) as DraftOrderResult
    return data
  } catch (err) {
    return { ok: false, reason: (err as Error).message }
  }
}

// Admin endpoints. Auth — if any — is the backend's call (cookie / IP allowlist /
// shared secret). The website forwards the request as-is; it doesn't itself
// participate in authentication.
export async function getDailyReport(): Promise<DailyReport | null> {
  return safeFetch<DailyReport>(`${BACKEND}/api/admin/today`)
}

export async function listAdminOrders(): Promise<OrderStatus[]> {
  const data = await safeFetch<{ orders: OrderStatus[] }>(`${BACKEND}/api/admin/orders`)
  return data?.orders ?? []
}

export async function listEscalations(): Promise<
  Array<{
    id: string
    thread_id: string
    channel: string
    reason: string
    severity: 'low' | 'medium' | 'high'
    status: string
    created_at: number
  }>
> {
  const data = await safeFetch<{
    escalations: Array<{
      id: string
      thread_id: string
      channel: string
      reason: string
      severity: 'low' | 'medium' | 'high'
      status: string
      created_at: number
    }>
  }>(`${BACKEND}/api/admin/escalations`)
  return data?.escalations ?? []
}
