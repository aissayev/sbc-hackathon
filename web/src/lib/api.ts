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

async function safeFetch<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, {
      ...init,
      next: { revalidate: process.env.NODE_ENV === 'production' ? 60 : 0 },
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

// TODO (backend handoff): the canonical catalog should come from the sandbox
// MCP `square_list_catalog` tool the backend already wires up — see
// `src/agent/mcp/local-server.ts` and `src/lib/sandbox-mcp.ts`. When the backend
// imports SKUs into its SQLite seed (or exposes a /api/catalog passthrough that
// wraps `square_list_catalog`), swap this function to:
//
//   const live = await safeFetch<{ products: Product[] }>(`${BACKEND}/api/products`)
//   if (!live?.products?.length) return CATALOG.filter(p => p.in_stock)
//   // merge live in_stock + daily_capacity onto our typed catalog rows by id
//   return CATALOG.map(p => ({ ...p, ...findById(live.products, p.id) }))
//                 .filter(p => p.in_stock)
//
// Until then we serve from lib/catalog.ts so /menu and /order match the photo
// pack and brand voice.
export async function listProducts(): Promise<Product[]> {
  return CATALOG.filter((p) => p.in_stock)
}

export async function getProduct(id: string): Promise<Product | null> {
  return findCatalogProduct(id)
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
