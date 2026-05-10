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

async function whatsappStatus(): Promise<ChannelStatus> {
  const r = await tryCallSandboxTool<SandboxThreadList>('whatsapp_list_threads', {})
  if (!r) {
    return {
      id: 'whatsapp', label: 'WhatsApp', connected: false, mode: 'down',
      webhookUrl: publicWebhook('/webhooks/whatsapp'),
      threadCount: 0, lastEventAt: 0,
      notes: 'Sandbox unreachable — SBC_TEAM_TOKEN may be unset.',
    }
  }
  const threads = (Array.isArray(r) ? r : (r.threads ?? r.inbound ?? [])) as SandboxThreadShape[]
  return {
    id: 'whatsapp', label: 'WhatsApp', connected: true,
    mode: r.simulated === false ? 'live' : 'sandbox',
    webhookUrl: publicWebhook('/webhooks/whatsapp'),
    threadCount: threads.length,
    lastEventAt: maxLastSeen(threads),
  }
}

async function instagramStatus(): Promise<ChannelStatus> {
  const r = await tryCallSandboxTool<SandboxThreadList>('instagram_list_dm_threads', {})
  if (!r) {
    return {
      id: 'instagram', label: 'Instagram', connected: false, mode: 'down',
      webhookUrl: publicWebhook('/webhooks/instagram'),
      threadCount: 0, lastEventAt: 0,
      notes: 'Sandbox unreachable — SBC_TEAM_TOKEN may be unset.',
    }
  }
  const threads = (Array.isArray(r) ? r : (r.threads ?? [])) as SandboxThreadShape[]
  return {
    id: 'instagram', label: 'Instagram', connected: true,
    mode: r.simulated === false ? 'live' : 'sandbox',
    webhookUrl: publicWebhook('/webhooks/instagram'),
    threadCount: threads.length,
    lastEventAt: maxLastSeen(threads),
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
  }
}

function telegramStatus(): ChannelStatus {
  const hasBotToken = Boolean(process.env.OWNER_BOT_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN)
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
      : 'OWNER_BOT_TOKEN not set. The owner bot won\'t respond.',
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
    const raw = await tryCallSandboxTool('whatsapp_inject_inbound', {
      from: '+12815559999',
      message: `Cockpit smoke test ${new Date().toISOString().slice(11, 19)}`,
    })
    if (raw == null) return { ok: false, channel, message: 'Sandbox inject_inbound failed.' }
    return { ok: true, channel, message: 'Injected test WhatsApp inbound. Check Inbox.', raw }
  }
  if (channel === 'instagram') {
    const raw = await tryCallSandboxTool('instagram_inject_dm', {
      from: 'test_user_123',
      message: `Cockpit smoke test ${new Date().toISOString().slice(11, 19)}`,
    })
    if (raw == null) return { ok: false, channel, message: 'Sandbox inject_dm failed.' }
    return { ok: true, channel, message: 'Injected test Instagram DM. Check Inbox.', raw }
  }
  return { ok: false, channel, message: `Channel ${channel} doesn't accept test inbound events.` }
}
