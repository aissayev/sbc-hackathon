// Server-side data fetcher. Talks to the Hono backend at BACKEND_URL.
//
// Catalog policy: the website's source of truth for `listProducts` /
// `getProduct` is `lib/catalog.ts` — the canonical HappyCake product list
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
  // ─── Collectible-card data (local catalog only) ────────────────────────
  // The "showcase" card variant treats each cake like a Pokémon-style
  // collectible: a tradition (where it comes from / what family it sits in),
  // a flavor stack (short ingredient breakdown), and a one-line tagline are
  // optional metadata only the local catalog populates. Backend signals
  // (in_stock, daily_capacity) don't carry these, so they stay optional.
  tradition?: ProductTradition
  flavor_notes?: string
  tagline?: string
}

export type ProductTradition =
  | 'kazakh-european-honey'
  | 'central-asian'
  | 'italian-classic'
  | 'modern-meringue'
  | 'french-chocolate'
  | 'celebration'
  | 'catering'

export interface OrderItem {
  sku: string
  qty: number
  unit_cents: number
  line_total_cents: number
  name: string
}

export interface OrderStatus {
  id: string
  // Short customer-facing alias — digits only, e.g. "1042". Stable per
  // order, safe to read aloud over the phone or write on a sticky note.
  // The UI prefixes a `#` for display (`#1042`). Optional because older
  // clients and edge paths may not populate it; UI falls back to `id`
  // when missing.
  friendly_id?: string
  status: string
  total_cents: number
  scheduled_at: string | null
  customer_name: string | null
  pickup_or_delivery: 'pickup' | 'delivery'
  items?: OrderItem[]
  kitchen_ticket_id?: string | null
  // True when ANY item needs explicit owner approval (custom design / catering
  // volume). Drives the tracker timeline: when false we render a 3-step rail
  // (Order received → In the kitchen → Ready) since the order auto-promotes;
  // when true we render the 4-step rail with the explicit "Approved" gate.
  requires_approval?: boolean
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
    // Admin endpoints carry mutable owner state (orders, threads, escalations)
    // that the cockpit must show at the latest second after a write +
    // router.refresh(). Skip the Next data cache for them; otherwise reuse
    // the standard 60s ISR window for catalog reads.
    const isAdmin = url.includes('/api/admin/')
    const res = await fetch(url, {
      ...withBackendSecret(init, url),
      ...(isAdmin
        ? { cache: 'no-store' as const }
        : { next: { revalidate: process.env.NODE_ENV === 'production' ? 60 : 0 } }),
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

export async function listProducts(opts?: { includeOutOfStock?: boolean }): Promise<Product[]> {
  const live = await fetchLiveSignals()
  const merged = CATALOG.map((p) => {
    const sig = live?.get(p.id)
    if (!sig) return p
    return {
      ...p,
      in_stock: sig.in_stock ?? p.in_stock,
      daily_capacity: sig.daily_capacity ?? p.daily_capacity,
    }
  })
  if (opts?.includeOutOfStock) return merged
  return merged.filter((p) => p.in_stock)
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
  // Short customer-facing alias (digits-only, e.g. "1042") returned by
  // the backend alongside the canonical `order_id`. The confirmation
  // page surfaces it as the headline label, and the post-order redirect
  // prefers it so URLs stay readable.
  friendly_id?: string
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

export type InboxChannel = 'whatsapp' | 'instagram' | 'web'

export interface InboxThreadRow {
  channel: InboxChannel
  id: string
  handle: string
  displayName?: string
  lastMessage: string
  lastMessageAt: number
  bucket: 'new' | 'mine'
}

export interface InboxThreadDetail extends InboxThreadRow {
  transcript: Array<{ role: 'customer' | 'us'; text: string; at: number }>
}

export async function listInboxThreads(opts?: {
  channel?: 'all' | InboxChannel
  bucket?: 'all' | 'new' | 'mine'
}): Promise<{
  threads: InboxThreadRow[]
  counts: { all: number; new: number; mine: number }
  errors: string[]
}> {
  const params = new URLSearchParams()
  if (opts?.channel) params.set('channel', opts.channel)
  if (opts?.bucket) params.set('bucket', opts.bucket)
  const qs = params.toString() ? `?${params.toString()}` : ''
  const data = await safeFetch<{
    threads: InboxThreadRow[]
    counts: { all: number; new: number; mine: number }
    errors: string[]
  }>(`${BACKEND}/api/admin/threads${qs}`)
  return data ?? { threads: [], counts: { all: 0, new: 0, mine: 0 }, errors: ['fetch_failed'] }
}

export async function getInboxThread(channel: InboxChannel, id: string): Promise<InboxThreadDetail | null> {
  return safeFetch<InboxThreadDetail>(
    `${BACKEND}/api/admin/threads/${channel}/${encodeURIComponent(id)}`,
  )
}

// ─── Channels manager ───────────────────────────────────────────────────

export type ChannelId = 'whatsapp' | 'instagram' | 'web' | 'telegram' | 'gbp'

export interface ChannelStatus {
  id: ChannelId
  label: string
  connected: boolean
  mode: 'live' | 'sandbox' | 'local' | 'down'
  webhookUrl?: string
  threadCount: number
  lastEventAt: number
  notes?: string
}

export async function listChannels(): Promise<ChannelStatus[]> {
  const data = await safeFetch<{ channels: ChannelStatus[] }>(`${BACKEND}/api/admin/channels`)
  return data?.channels ?? []
}

export async function getChannel(id: ChannelId): Promise<ChannelStatus | null> {
  return safeFetch<ChannelStatus>(`${BACKEND}/api/admin/channels/${id}`)
}

// ─── Campaigns + Approvals (Posts queue) ────────────────────────────────

export interface CampaignSummary {
  id: string
  name?: string
  channel?: string
  status?: 'draft' | 'queued' | 'running' | 'paused' | 'closed' | 'unknown'
  budgetUsd?: number
  spendUsd?: number
  leads?: number
  impressions?: number
  clicks?: number
  conversions?: number
  startedAt?: number
  notes?: string
}

export interface CampaignsCockpit {
  monthlyBudgetUsd: number
  targetEffectUsd: number
  spendUsd: number
  remainingUsd: number
  leadsTotal: number
  campaigns: CampaignSummary[]
  recommendedStrategyId?: string
  errors: string[]
}

export interface CampaignDetail extends CampaignSummary {
  source: 'sandbox' | 'local-plan'
  thesis?: string
  rolloutMonths?: Record<string, { phase: string; spendUsd?: number; expectedOutcomes?: Record<string, number | string> }>
}

export async function getCampaignsCockpit(): Promise<CampaignsCockpit> {
  return (await safeFetch<CampaignsCockpit>(`${BACKEND}/api/admin/campaigns`)) ?? {
    monthlyBudgetUsd: 0, targetEffectUsd: 0, spendUsd: 0, remainingUsd: 0,
    leadsTotal: 0, campaigns: [], errors: ['fetch_failed'],
  }
}

export async function getCampaignDetail(id: string): Promise<CampaignDetail | null> {
  return safeFetch<CampaignDetail>(`${BACKEND}/api/admin/campaigns/${encodeURIComponent(id)}`)
}

export type ApprovalKind = 'campaign' | 'creative' | 'budget_change' | 'reply'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export interface OwnerApproval {
  id: string
  kind: ApprovalKind
  summary: string
  detail: string
  channel: 'instagram' | 'whatsapp' | 'gbp' | 'web' | 'telegram' | null
  status: ApprovalStatus
  decisionNote: string | null
  createdAt: number
  decidedAt: number | null
}

export async function listApprovals(status: ApprovalStatus | 'all' = 'pending'): Promise<{
  approvals: OwnerApproval[]
  counts: { pending: number; approved: number; rejected: number }
}> {
  const data = await safeFetch<{
    approvals: OwnerApproval[]
    counts: { pending: number; approved: number; rejected: number }
  }>(`${BACKEND}/api/admin/approvals?status=${status}`)
  return data ?? { approvals: [], counts: { pending: 0, approved: 0, rejected: 0 } }
}

// ─── Settings + audit ──────────────────────────────────────────────────

export interface CockpitSettings {
  env: {
    publicUrl: string | null
    sandboxMcpUrl: string | null
    sandboxTeamToken: 'set' | 'unset'
    ownerBotToken: 'set' | 'unset'
    whatsappToken: 'set' | 'unset'
    whatsappPhoneNumberId: string | null
    instagramToken: 'set' | 'unset'
    webBackendSecret: 'set' | 'unset'
    nodeEnv: string
  }
  webhooks: Array<{ channel: string; url: string | null; reachable: boolean }>
  db: { path: string; tables: Array<{ name: string; rows: number }> }
}

export type AuditAction =
  | 'approval_approve' | 'approval_reject'
  | 'thread_reply'
  | 'channel_register' | 'channel_test'
  | 'campaign_pause' | 'campaign_resume' | 'campaign_adjust'
  | 'order_approve' | 'order_reject'

export interface AuditEvent {
  id: string
  action: AuditAction
  targetId: string | null
  channel: string | null
  result: string | null
  outcome: 'ok' | 'error'
  createdAt: number
}

export async function getCockpitSettings(): Promise<CockpitSettings | null> {
  return safeFetch<CockpitSettings>(`${BACKEND}/api/admin/settings`)
}

export async function listAuditEvents(limit = 100): Promise<{
  events: AuditEvent[]
  counts: { total: number; today: number; errors: number }
}> {
  const data = await safeFetch<{
    events: AuditEvent[]
    counts: { total: number; today: number; errors: number }
  }>(`${BACKEND}/api/admin/audit?limit=${limit}`)
  return data ?? { events: [], counts: { total: 0, today: 0, errors: 0 } }
}
