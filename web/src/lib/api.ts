// Server-side data fetcher. Talks to the Hono backend at BACKEND_URL.
// Falls back to the local seed catalog when the backend is unreachable —
// this means the website renders the menu even before/without /api/* live,
// which matters for the hackathon demo and for resilient agent crawls.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export interface Product {
  id: string
  name: string
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

let seedCache: { products: Product[] } | null = null
function loadSeed(): { products: Product[] } {
  if (seedCache) return seedCache
  try {
    const path = resolve(process.cwd(), '..', 'data', 'catalog', 'happycake.seed.json')
    const raw = readFileSync(path, 'utf8')
    const parsed = JSON.parse(raw) as { products: Product[] }
    seedCache = parsed
    return parsed
  } catch {
    seedCache = { products: [] }
    return seedCache
  }
}

async function safeFetch<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, {
      ...init,
      // Re-fetch products every request in dev; revalidate every 60s in prod.
      next: { revalidate: process.env.NODE_ENV === 'production' ? 60 : 0 },
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export async function listProducts(): Promise<Product[]> {
  const data = await safeFetch<{ products: Product[] }>(`${BACKEND}/api/products`)
  if (data?.products?.length) return data.products
  return loadSeed().products.filter((p) => p.in_stock)
}

export async function getProduct(id: string): Promise<Product | null> {
  const direct = await safeFetch<Product>(`${BACKEND}/api/products/${encodeURIComponent(id)}`)
  if (direct && (direct as Product).id) return direct
  return loadSeed().products.find((p) => p.id === id) ?? null
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
