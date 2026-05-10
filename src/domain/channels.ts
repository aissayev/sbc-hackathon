// Channels manager — one card per channel for the BotFather-style cockpit.
// We surface: connection status, recent activity counts, webhook URL, and
// per-channel actions (register webhook, send test event).

import { tryCallSandboxTool } from '../lib/sandbox-mcp.ts'
import { getDb } from '../db/db.ts'
import { config } from '../config.ts'

export type ChannelId = 'whatsapp' | 'instagram' | 'web' | 'telegram' | 'gbp'

export interface ChannelStatus {
  id: ChannelId
  label: string
  connected: boolean
  // 'live'    — wired to a sandbox + answering
  // 'sandbox' — sandbox reachable but no real creds (simulated mode)
  // 'local'   — local-only (web chat lives in our DB)
  // 'down'    — sandbox unreachable / token missing
  mode: 'live' | 'sandbox' | 'local' | 'down'
  webhookUrl?: string
  threadCount: number
  lastEventAt: number   // ms epoch, 0 if unknown
  notes?: string
  // Real-Meta credential state — independent of the sandbox `mode`. Lets the
  // cockpit truthfully say "yes the sandbox is replying, but real customers
  // on real WhatsApp/Instagram are NOT being reached because PHONE_NUMBER_ID
  // is missing", without that being hidden behind the same "sandbox" label.
  //   'complete'    — every env var needed for live Meta send + signed
  //                   webhook is set; PUBLIC_URL is also set so Meta can
  //                   reach us. The dual-path 'both' mode actually does both.
  //   'partial'     — some Meta vars set, others missing. Outbound real
  //                   calls SILENTLY no-op (early-return inside the channel
  //                   adapter); customer never sees our reply on real Meta.
  //   'unset'       — no Meta credentials at all. Pure sandbox.
  //   'unsupported' — channel doesn't have a real-Meta path (e.g. web).
  liveMeta?: {
    state: 'complete' | 'partial' | 'unset' | 'unsupported'
    /** Env-var names that need to be set for `state` to graduate to 'complete'. */
    missing: string[]
    /** Plain-English summary the cockpit notes line shows verbatim. */
    summary: string
  }
}

interface SandboxThreadShape {
  threadId?: string
  id?: string
  lastMessageAt?: string | number
  last_message_at?: string | number
  updatedAt?: string | number
  updated_at?: string | number
}

interface SandboxThreadList {
  threads?: SandboxThreadShape[]
  inbound?: SandboxThreadShape[]
  outbound?: SandboxThreadShape[]
  simulated?: boolean
}

function toEpoch(v: string | number | undefined): number {
  if (v == null) return 0
  if (typeof v === 'number') return v < 1e12 ? v * 1000 : v
  const n = Date.parse(v)
  return Number.isFinite(n) ? n : 0
}

function maxLastSeen(threads: SandboxThreadShape[] = []): number {
  let max = 0
  for (const t of threads) {
    const at = toEpoch(t.lastMessageAt ?? t.last_message_at ?? t.updatedAt ?? t.updated_at)
    if (at > max) max = at
  }
  return max
}

function publicWebhook(path: string): string | undefined {
  const base = config.publicUrl
  if (!base) return undefined
  return `${base.replace(/\/$/, '')}${path}`
}

// Real-Meta credential introspection. Reads the same env vars the channel
// adapters consult before firing a real Cloud / Graph API call. Outputs the
// liveMeta shape exposed on ChannelStatus.
function whatsappLiveMeta(): NonNullable<ChannelStatus['liveMeta']> {
  const checks: Array<{ key: string; present: boolean }> = [
    { key: 'WA_TOKEN', present: Boolean(config.whatsapp.token) },
    { key: 'WA_PHONE_NUMBER_ID', present: Boolean(config.whatsapp.phoneNumberId) },
    { key: 'WA_APP_SECRET', present: Boolean(config.whatsapp.appSecret) },
    { key: 'PUBLIC_URL', present: Boolean(config.publicUrl) },
  ]
  const missing = checks.filter((c) => !c.present).map((c) => c.key)
  const setCount = checks.length - missing.length
  if (setCount === 0) {
    return { state: 'unset', missing, summary: 'No real-WhatsApp credentials set. Sandbox-only.' }
  }
  if (missing.length === 0) {
    return {
      state: 'complete', missing,
      summary: 'Live WhatsApp Cloud API wired. Real customer messages get a real reply.',
    }
  }
  // Partial. Real outbound calls will silently no-op inside whatsappAdapter.
  return {
    state: 'partial', missing,
    summary: `Real WhatsApp partially wired. Real customers will NOT receive replies until you set: ${missing.join(', ')}. Sandbox replies still work.`,
  }
}

function instagramLiveMeta(): NonNullable<ChannelStatus['liveMeta']> {
  const checks: Array<{ key: string; present: boolean }> = [
    { key: 'IG_TOKEN', present: Boolean(config.instagram.token) },
    { key: 'IG_USER_ID', present: Boolean(config.instagram.userId) },
    { key: 'IG_APP_ID', present: Boolean(config.instagram.appId) },
    { key: 'IG_APP_SECRET', present: Boolean(config.instagram.appSecret) },
    { key: 'PUBLIC_URL', present: Boolean(config.publicUrl) },
  ]
  const missing = checks.filter((c) => !c.present).map((c) => c.key)
  const setCount = checks.length - missing.length
  if (setCount === 0) {
    return { state: 'unset', missing, summary: 'No real-Instagram credentials set. Sandbox-only.' }
  }
  if (missing.length === 0) {
    return {
      state: 'complete', missing,
      summary: 'Live Instagram Graph API wired. Real DMs and comments get a real reply.',
    }
  }
  return {
    state: 'partial', missing,
    summary: `Real Instagram partially wired. Real DMs will NOT receive replies until you set: ${missing.join(', ')}. Sandbox replies still work.`,
  }
}

async function whatsappStatus(): Promise<ChannelStatus> {
  const liveMeta = whatsappLiveMeta()
  const r = await tryCallSandboxTool<SandboxThreadList>('whatsapp_list_threads', {})
  if (!r) {
    return {
      id: 'whatsapp', label: 'WhatsApp', connected: false, mode: 'down',
      webhookUrl: publicWebhook('/webhooks/whatsapp'),
      threadCount: 0, lastEventAt: 0,
      notes: 'Sandbox unreachable — SBC_TEAM_TOKEN may be unset.',
      liveMeta,
    }
  }
  const threads = (Array.isArray(r) ? r : (r.threads ?? r.inbound ?? [])) as SandboxThreadShape[]
  return {
    id: 'whatsapp', label: 'WhatsApp', connected: true,
    mode: r.simulated === false ? 'live' : 'sandbox',
    webhookUrl: publicWebhook('/webhooks/whatsapp'),
    threadCount: threads.length,
    lastEventAt: maxLastSeen(threads),
    notes: liveMeta.state === 'complete' ? undefined : liveMeta.summary,
    liveMeta,
  }
}

async function instagramStatus(): Promise<ChannelStatus> {
  const liveMeta = instagramLiveMeta()
  const r = await tryCallSandboxTool<SandboxThreadList>('instagram_list_dm_threads', {})
  if (!r) {
    return {
      id: 'instagram', label: 'Instagram', connected: false, mode: 'down',
      webhookUrl: publicWebhook('/webhooks/instagram'),
      threadCount: 0, lastEventAt: 0,
      notes: 'Sandbox unreachable — SBC_TEAM_TOKEN may be unset.',
      liveMeta,
    }
  }
  const threads = (Array.isArray(r) ? r : (r.threads ?? [])) as SandboxThreadShape[]
  return {
    id: 'instagram', label: 'Instagram', connected: true,
    mode: r.simulated === false ? 'live' : 'sandbox',
    webhookUrl: publicWebhook('/webhooks/instagram'),
    threadCount: threads.length,
    lastEventAt: maxLastSeen(threads),
    notes: liveMeta.state === 'complete' ? undefined : liveMeta.summary,
    liveMeta,
  }
}

function webChatStatus(): ChannelStatus {
  const row = getDb()
    .prepare("SELECT COUNT(*) as c, COALESCE(MAX(updated_at), 0) as max FROM threads WHERE channel = 'web'")
    .get() as { c: number; max: number }
  return {
    id: 'web', label: 'Website chat', connected: true, mode: 'local',
    threadCount: row.c, lastEventAt: row.max,
    notes: 'Lives in our SQLite — no external webhook to register.',
    liveMeta: { state: 'unsupported', missing: [], summary: '' },
  }
}

function telegramStatus(): ChannelStatus {
  // Read the same env names config.ts uses (TG_OWNER_BOT_TOKEN). The legacy
  // names below are kept as fallbacks so an older .env.local without the TG_
  // prefix still resolves to "connected".
  const hasBotToken = Boolean(
    process.env.TG_OWNER_BOT_TOKEN ??
      process.env.OWNER_BOT_TOKEN ??
      process.env.TELEGRAM_BOT_TOKEN,
  )
  const row = getDb()
    .prepare("SELECT COUNT(*) as c, COALESCE(MAX(updated_at), 0) as max FROM threads WHERE channel = 'telegram'")
    .get() as { c: number; max: number }
  return {
    id: 'telegram', label: 'Telegram bot',
    connected: hasBotToken,
    mode: hasBotToken ? 'live' : 'down',
    webhookUrl: publicWebhook('/webhooks/telegram'),
    threadCount: row.c, lastEventAt: row.max,
    notes: hasBotToken
      ? 'Owner bot online — handles approvals, escalations, async commands.'
      : 'TG_OWNER_BOT_TOKEN not set. The owner bot won\'t respond.',
    liveMeta: { state: 'unsupported', missing: [], summary: '' },
  }
}

interface GbReviewShape { updatedAt?: string | number; updated_at?: string | number; createTime?: string }

async function gbpStatus(): Promise<ChannelStatus> {
  const r = await tryCallSandboxTool<{ reviews?: GbReviewShape[] } | GbReviewShape[]>('gb_list_reviews', {})
  if (!r) {
    return {
      id: 'gbp', label: 'Google Business', connected: false, mode: 'down',
      threadCount: 0, lastEventAt: 0,
      notes: 'Sandbox unreachable — SBC_TEAM_TOKEN may be unset.',
    }
  }
  const reviews = (Array.isArray(r) ? r : (r.reviews ?? [])) as GbReviewShape[]
  let lastEventAt = 0
  for (const rv of reviews) {
    const t = toEpoch(rv.updatedAt ?? rv.updated_at ?? rv.createTime)
    if (t > lastEventAt) lastEventAt = t
  }
  return {
    id: 'gbp', label: 'Google Business', connected: true, mode: 'sandbox',
    threadCount: reviews.length, lastEventAt,
    notes: 'Reviews + posts via sandbox.',
    liveMeta: { state: 'unsupported', missing: [], summary: '' },
  }
}

export async function listChannelStatuses(): Promise<ChannelStatus[]> {
  const [wa, ig, gbp] = await Promise.all([
    whatsappStatus(),
    instagramStatus(),
    gbpStatus(),
  ])
  return [webChatStatus(), telegramStatus(), wa, ig, gbp]
}

export async function getChannelStatus(id: ChannelId): Promise<ChannelStatus | null> {
  if (id === 'web') return webChatStatus()
  if (id === 'telegram') return telegramStatus()
  if (id === 'whatsapp') return await whatsappStatus()
  if (id === 'instagram') return await instagramStatus()
  if (id === 'gbp') return await gbpStatus()
  return null
}

export interface WebhookActionResult {
  ok: boolean
  channel: ChannelId
  message: string
  raw?: unknown
}

export async function registerChannelWebhook(channel: ChannelId): Promise<WebhookActionResult> {
  if (channel === 'whatsapp' || channel === 'instagram') {
    const url = publicWebhook(`/webhooks/${channel}`)
    if (!url) return {
      ok: false, channel,
      message: 'PUBLIC_URL not set on the backend. Set it (e.g. an ngrok URL) and try again.',
    }
    const tool = channel === 'whatsapp' ? 'whatsapp_register_webhook' : 'instagram_register_webhook'
    const raw = await tryCallSandboxTool<{ ok?: boolean; success?: boolean; appId?: string; pageId?: string }>(tool, { url })
    if (!raw) return { ok: false, channel, message: `Sandbox ${tool} call failed.` }
    const ok = raw.ok !== false && raw.success !== false
    const msg = ok
      ? `Registered ${channel} webhook → ${url}.${raw.appId ? ` appId=${raw.appId}` : ''}${raw.pageId ? ` pageId=${raw.pageId}` : ''}`
      : `Sandbox returned an error: ${JSON.stringify(raw).slice(0, 160)}`
    return { ok, channel, message: msg, raw }
  }
  return { ok: false, channel, message: `Channel ${channel} doesn't have a webhook to register.` }
}

export async function sendTestInbound(channel: ChannelId): Promise<WebhookActionResult> {
  if (channel === 'whatsapp') {
    return simulateInbound({
      channel: 'whatsapp',
      handle: '+12815559999',
      message: `Cockpit smoke test ${new Date().toISOString().slice(11, 19)}`,
    })
  }
  if (channel === 'instagram') {
    return simulateInbound({
      channel: 'instagram',
      handle: 'test_user_123',
      message: `Cockpit smoke test ${new Date().toISOString().slice(11, 19)}`,
    })
  }
  return { ok: false, channel, message: `Channel ${channel} doesn't accept test inbound events.` }
}

export interface SimulateInboundInput {
  channel: 'whatsapp' | 'instagram'
  /** Phone in E.164 (`+12815551234`) for WA; IG username (no `@`) for Instagram. */
  handle: string
  message: string
}

/**
 * Inject an inbound customer message via the sandbox MCP. The sandbox
 * routes it back to our /webhooks/* endpoint (registered separately
 * via `bun run register-webhooks <public-url>`) — at which point our
 * existing onMessage pipeline takes over: pickRole → claude -p →
 * outbound reply via whatsapp_send / instagram_send_dm. Subsequent
 * customer messages on the same handle thread under the same id, so
 * the conversation history is preserved without any extra plumbing.
 *
 * Pre-reqs:
 *   - SBC_TEAM_TOKEN set so the sandbox MCP accepts the call.
 *   - Webhooks registered (`bun run register-webhooks <https-url>`)
 *     so the sandbox knows where to push the simulated inbound. Without
 *     this the inject succeeds but the message never reaches us.
 *
 * Returns the same WebhookActionResult shape as registerChannelWebhook
 * for symmetry — the admin route can render either result the same way.
 */
export async function simulateInbound(
  input: SimulateInboundInput,
): Promise<WebhookActionResult> {
  const handle = input.handle.trim()
  const message = input.message.trim()
  if (!handle) return { ok: false, channel: input.channel, message: 'Handle is required.' }
  if (!message) return { ok: false, channel: input.channel, message: 'Message is required.' }

  if (input.channel === 'whatsapp') {
    if (!handle.startsWith('+') || handle.length < 8) {
      return {
        ok: false,
        channel: 'whatsapp',
        message: 'WhatsApp number must be in E.164 format (e.g. +12815551234).',
      }
    }
    const raw = await tryCallSandboxTool('whatsapp_inject_inbound', {
      from: handle,
      message,
    })
    if (raw == null) {
      return { ok: false, channel: 'whatsapp', message: 'Sandbox whatsapp_inject_inbound failed.' }
    }
    return {
      ok: true,
      channel: 'whatsapp',
      message: `Injected as WhatsApp from ${handle}. Reply will land back here.`,
      raw,
    }
  }

  // Instagram — accept @handle or bare handle, normalize off the @.
  const igHandle = handle.startsWith('@') ? handle.slice(1) : handle
  if (igHandle.length < 2) {
    return { ok: false, channel: 'instagram', message: 'Instagram handle is too short.' }
  }
  // The sandbox tool requires `threadId` in addition to `from` + `message`
  // (verified live 2026-05-10 via probe: posting only `from` + `message`
  // returns "threadId, from, message required"). Use the IG handle as the
  // thread id so repeat injections from the same user collapse onto a
  // single thread the way Instagram itself would.
  const raw = await tryCallSandboxTool('instagram_inject_dm', {
    threadId: igHandle,
    from: igHandle,
    message,
  })
  if (raw == null) {
    return { ok: false, channel: 'instagram', message: 'Sandbox instagram_inject_dm failed.' }
  }
  return {
    ok: true,
    channel: 'instagram',
    message: `Injected as Instagram DM from @${igHandle}. Reply will land back here.`,
    raw,
  }
}
