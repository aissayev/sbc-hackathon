// Unified inbox — aggregates message threads across channels for the
// owner cockpit. Three sources:
//
//   1. WhatsApp  — sandbox `whatsapp_list_threads` (live)
//   2. Instagram — sandbox `instagram_list_dm_threads` (live)
//   3. Web chat  — local DB `threads` table (persisted in src/db/threads.ts)
//
// "Bucket" semantics:
//   - `new`  : last message is from the customer (no owner reply since)
//   - `mine` : last message is from the owner / agent
//   - `all`  : everything
//
// We don't deeply normalise — different channels expose different fields
// and we'd lose information by forcing a lowest-common-denominator. The
// `InboxThreadRow` shape carries enough for the list page; the detail
// route returns the raw transcript when available.

import { tryCallSandboxTool } from '../lib/sandbox-mcp.ts'
import { getDb } from '../db/db.ts'
import { loadHistory, type HistoryEntry } from '../db/threads.ts'

export type InboxChannel = 'whatsapp' | 'instagram' | 'web'

export interface InboxThreadRow {
  channel: InboxChannel
  id: string
  handle: string
  displayName?: string
  lastMessage: string
  lastMessageAt: number  // ms epoch (0 if unknown)
  bucket: 'new' | 'mine'
}

export interface InboxThreadDetail extends InboxThreadRow {
  transcript: Array<{
    role: 'customer' | 'us'
    text: string
    at: number
  }>
}

interface ListOpts {
  channel: 'all' | InboxChannel
  bucket: 'all' | 'new' | 'mine'
}

interface SandboxThreadShape {
  threadId?: string
  id?: string
  from?: string
  to?: string
  customerHandle?: string
  customer_handle?: string
  customerName?: string
  customer_name?: string
  lastMessage?: string
  last_message?: string
  lastMessageAt?: string | number
  last_message_at?: string | number
  updatedAt?: string | number
  updated_at?: string | number
  lastDirection?: 'inbound' | 'outbound'
  last_direction?: 'inbound' | 'outbound'
  unread?: boolean
  unreadCount?: number
  unread_count?: number
  messages?: Array<{
    direction?: 'inbound' | 'outbound'
    from?: string
    role?: string
    text?: string
    body?: string
    message?: string
    at?: string | number
    ts?: string | number
    timestamp?: string | number
  }>
}

function toEpoch(v: string | number | undefined): number {
  if (v == null) return 0
  if (typeof v === 'number') return v < 1e12 ? v * 1000 : v
  const parsed = Date.parse(v)
  return Number.isFinite(parsed) ? parsed : 0
}

function normaliseSandboxThread(channel: 'whatsapp' | 'instagram', t: SandboxThreadShape): InboxThreadRow {
  const id = t.threadId ?? t.id ?? t.from ?? t.customerHandle ?? t.customer_handle ?? '?'
  const handle = t.customerHandle ?? t.customer_handle ?? t.from ?? id
  const displayName = t.customerName ?? t.customer_name
  const lastMessage = (t.lastMessage ?? t.last_message ?? '').toString()
  const lastMessageAt = toEpoch(t.lastMessageAt ?? t.last_message_at ?? t.updatedAt ?? t.updated_at)
  const dir = t.lastDirection ?? t.last_direction
  const explicitUnread = t.unread === true || (t.unreadCount ?? t.unread_count ?? 0) > 0
  const bucket: 'new' | 'mine' =
    explicitUnread || dir === 'inbound' ? 'new' :
    dir === 'outbound' ? 'mine' :
    'new'   // when sandbox doesn't tell us, lean toward "needs attention"
  return { channel, id: String(id), handle: String(handle), displayName, lastMessage, lastMessageAt, bucket }
}

function lastNonEmpty(history: HistoryEntry[]): HistoryEntry | undefined {
  for (let i = history.length - 1; i >= 0; i--) {
    if ((history[i].content ?? '').trim()) return history[i]
  }
  return undefined
}

function loadWebThreads(): InboxThreadRow[] {
  const rows = getDb()
    .prepare(
      `SELECT thread_id, sender_id, sender_name, history_json, updated_at
       FROM threads
       WHERE channel = 'web'
       ORDER BY updated_at DESC
       LIMIT 50`,
    )
    .all() as Array<{
      thread_id: string
      sender_id: string | null
      sender_name: string | null
      history_json: string
      updated_at: number
    }>

  const out: InboxThreadRow[] = []
  for (const r of rows) {
    let history: HistoryEntry[] = []
    try { history = JSON.parse(r.history_json) as HistoryEntry[] } catch {}
    const last = lastNonEmpty(history)
    if (!last) continue
    out.push({
      channel: 'web',
      id: r.thread_id,
      handle: r.sender_name ?? r.sender_id ?? r.thread_id,
      displayName: r.sender_name ?? undefined,
      lastMessage: last.content,
      lastMessageAt: last.ts ?? r.updated_at,
      bucket: last.role === 'user' ? 'new' : 'mine',
    })
  }
  return out
}

export async function listInboxThreads(opts: ListOpts): Promise<{
  threads: InboxThreadRow[]
  counts: { all: number; new: number; mine: number }
  errors: string[]
}> {
  const { channel, bucket } = opts
  const errors: string[] = []
  const collectors: Promise<InboxThreadRow[]>[] = []

  if (channel === 'all' || channel === 'whatsapp') {
    collectors.push(
      tryCallSandboxTool<{ threads?: SandboxThreadShape[] } | SandboxThreadShape[]>('whatsapp_list_threads', {})
        .then((r) => {
          if (!r) { errors.push('whatsapp'); return [] }
          const arr = Array.isArray(r) ? r : (r.threads ?? [])
          return arr.map((t) => normaliseSandboxThread('whatsapp', t))
        }),
    )
  }
  if (channel === 'all' || channel === 'instagram') {
    collectors.push(
      tryCallSandboxTool<{ threads?: SandboxThreadShape[] } | SandboxThreadShape[]>('instagram_list_dm_threads', {})
        .then((r) => {
          if (!r) { errors.push('instagram'); return [] }
          const arr = Array.isArray(r) ? r : (r.threads ?? [])
          return arr.map((t) => normaliseSandboxThread('instagram', t))
        }),
    )
  }
  if (channel === 'all' || channel === 'web') {
    collectors.push(Promise.resolve(loadWebThreads()))
  }

  const lists = await Promise.all(collectors)
  const all = lists.flat().sort((a, b) => b.lastMessageAt - a.lastMessageAt)

  const counts = {
    all: all.length,
    new: all.filter((t) => t.bucket === 'new').length,
    mine: all.filter((t) => t.bucket === 'mine').length,
  }

  const filtered = bucket === 'all' ? all : all.filter((t) => t.bucket === bucket)
  return { threads: filtered, counts, errors }
}

export async function getInboxThread(channel: InboxChannel, id: string): Promise<InboxThreadDetail | null> {
  if (channel === 'web') {
    const row = getDb()
      .prepare('SELECT thread_id, sender_id, sender_name, history_json, updated_at FROM threads WHERE thread_id = ? AND channel = ?')
      .get(id, 'web') as { thread_id: string; sender_id: string | null; sender_name: string | null; history_json: string; updated_at: number } | undefined
    if (!row) return null
    let history: HistoryEntry[] = []
    try { history = JSON.parse(row.history_json) as HistoryEntry[] } catch {}
    const transcript = history.map((h) => ({
      role: (h.role === 'user' ? 'customer' : 'us') as 'customer' | 'us',
      text: h.content,
      at: h.ts,
    }))
    const last = lastNonEmpty(history)
    return {
      channel: 'web',
      id: row.thread_id,
      handle: row.sender_name ?? row.sender_id ?? row.thread_id,
      displayName: row.sender_name ?? undefined,
      lastMessage: last?.content ?? '',
      lastMessageAt: last?.ts ?? row.updated_at,
      bucket: last && last.role === 'user' ? 'new' : 'mine',
      transcript,
    }
  }

  // For sandbox channels we re-query the list and find this thread.
  // The sandbox list response *may* embed `messages[]`; if so we use it.
  const tool = channel === 'whatsapp' ? 'whatsapp_list_threads' : 'instagram_list_dm_threads'
  const r = await tryCallSandboxTool<{ threads?: SandboxThreadShape[] } | SandboxThreadShape[]>(tool, {})
  if (!r) return null
  const arr = Array.isArray(r) ? r : (r.threads ?? [])
  const found = arr.find((t) => (t.threadId ?? t.id) === id)
  if (!found) return null
  const base = normaliseSandboxThread(channel, found)
  const transcript = (found.messages ?? []).map((m) => {
    const dir = m.direction ?? (m.role === 'assistant' ? 'outbound' : 'inbound')
    const text = m.text ?? m.body ?? m.message ?? ''
    return {
      role: (dir === 'inbound' ? 'customer' : 'us') as 'customer' | 'us',
      text,
      at: toEpoch(m.at ?? m.ts ?? m.timestamp),
    }
  })
  // Fallback — if the sandbox didn't embed messages, at least show the snippet.
  if (transcript.length === 0 && base.lastMessage) {
    transcript.push({
      role: base.bucket === 'new' ? 'customer' : 'us',
      text: base.lastMessage,
      at: base.lastMessageAt,
    })
  }
  return { ...base, transcript }
}

export async function replyToInboxThread(channel: InboxChannel, id: string, text: string): Promise<{
  ok: boolean
  channel: InboxChannel
  id: string
  error?: string
}> {
  if (channel === 'whatsapp') {
    const r = await tryCallSandboxTool('whatsapp_send', { to: id, message: text })
    if (r == null) return { ok: false, channel, id, error: 'sandbox_call_failed' }
    return { ok: true, channel, id }
  }
  if (channel === 'instagram') {
    const r = await tryCallSandboxTool('instagram_send_dm', { threadId: id, message: text })
    if (r == null) return { ok: false, channel, id, error: 'sandbox_call_failed' }
    return { ok: true, channel, id }
  }
  // Web chat — append the owner message to history. The customer's open
  // browser tab will pick it up on next poll. (The website chat widget
  // already polls; an SSE upgrade is future work.)
  const row = getDb()
    .prepare('SELECT history_json, channel, sender_id, sender_name FROM threads WHERE thread_id = ?')
    .get(id) as { history_json: string; channel: string; sender_id: string | null; sender_name: string | null } | undefined
  if (!row || row.channel !== 'web') {
    return { ok: false, channel: 'web', id, error: 'thread_not_found' }
  }
  let history: HistoryEntry[] = []
  try { history = JSON.parse(row.history_json) as HistoryEntry[] } catch {}
  history.push({ role: 'assistant', content: text, ts: Date.now() })
  const json = JSON.stringify(history)
  getDb()
    .prepare('UPDATE threads SET history_json = ?, updated_at = ? WHERE thread_id = ?')
    .run(json, Date.now(), id)
  return { ok: true, channel: 'web', id }
}
