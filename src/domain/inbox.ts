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
import { type HistoryEntry } from '../db/threads.ts'
import { whatsappAdapter } from '../channels/whatsapp.ts'
import { instagramAdapter } from '../channels/instagram/index.ts'
import {
  recordOutbound,
  listOutboundForThread,
  latestOutboundByThread,
} from './inbox-outbound.ts'

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

// The sandbox's `whatsapp_list_threads` / `instagram_list_dm_threads`
// actually return a flat shape — `{ inbound: [...], outbound: [...],
// simulated: bool }` — not a `threads[]` array. We learned this the hard
// way: the agent's owner cockpit reported "Outbound: 0" because it (and
// our admin code) read `result.threads` and got nothing, even though the
// sandbox had logged 16+ inbound messages. See diag-wa-outbound.ts for
// the proof. Group those flat arrays by sender/recipient into thread rows
// so the rest of the pipeline keeps working.
interface SandboxFlatMessage {
  ts?: string | number
  from?: string
  to?: string
  threadId?: string
  thread_id?: string
  message?: string
  text?: string
  body?: string
}

interface SandboxFlatThreads {
  inbound?: SandboxFlatMessage[]
  outbound?: SandboxFlatMessage[]
  simulated?: boolean
}

function isFlatShape(r: unknown): r is SandboxFlatThreads {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return false
  const obj = r as Record<string, unknown>
  return Array.isArray(obj.inbound) || Array.isArray(obj.outbound)
}

function buildThreadsFromFlat(
  channel: 'whatsapp' | 'instagram',
  flat: SandboxFlatThreads,
): InboxThreadRow[] {
  // Group by counterparty handle. For WA the handle is the phone number,
  // for IG it's the threadId/handle. Keep the latest message per handle
  // and the direction of that latest message, so bucket = new/mine works.
  type Acc = { latestTs: number; latestText: string; latestDir: 'inbound' | 'outbound' }
  const byHandle = new Map<string, Acc>()
  const handleOf = (m: SandboxFlatMessage, dir: 'inbound' | 'outbound') => {
    if (channel === 'whatsapp') return (dir === 'inbound' ? m.from : m.to) ?? m.threadId ?? m.thread_id ?? '?'
    return m.threadId ?? m.thread_id ?? (dir === 'inbound' ? m.from : m.to) ?? '?'
  }
  const bodyOf = (m: SandboxFlatMessage) => (m.message ?? m.text ?? m.body ?? '').toString()
  for (const m of flat.inbound ?? []) {
    const handle = String(handleOf(m, 'inbound'))
    if (handle === '?') continue
    const ts = toEpoch(m.ts)
    const cur = byHandle.get(handle)
    if (!cur || ts >= cur.latestTs) {
      byHandle.set(handle, { latestTs: ts, latestText: bodyOf(m), latestDir: 'inbound' })
    }
  }
  for (const m of flat.outbound ?? []) {
    const handle = String(handleOf(m, 'outbound'))
    if (handle === '?') continue
    const ts = toEpoch(m.ts)
    const cur = byHandle.get(handle)
    if (!cur || ts >= cur.latestTs) {
      byHandle.set(handle, { latestTs: ts, latestText: bodyOf(m), latestDir: 'outbound' })
    }
  }
  const rows: InboxThreadRow[] = []
  for (const [handle, acc] of byHandle) {
    rows.push({
      channel,
      id: handle,
      handle,
      lastMessage: acc.latestText,
      lastMessageAt: acc.latestTs,
      bucket: acc.latestDir === 'outbound' ? 'mine' : 'new',
    })
  }
  return rows
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

  // Both whatsapp_list_threads and instagram_list_dm_threads can return
  // either the per-thread shape `{ threads: [...] }` (newer) or the flat
  // `{ inbound: [...], outbound: [...], simulated: bool }` shape that the
  // sandbox actually returns today. Handle both — see buildThreadsFromFlat
  // for the grouping logic.
  if (channel === 'all' || channel === 'whatsapp') {
    collectors.push(
      tryCallSandboxTool<
        { threads?: SandboxThreadShape[] } | SandboxThreadShape[] | SandboxFlatThreads
      >('whatsapp_list_threads', {}).then((r) => {
        if (!r) { errors.push('whatsapp'); return [] }
        if (isFlatShape(r)) return buildThreadsFromFlat('whatsapp', r)
        const arr = Array.isArray(r) ? r : (r.threads ?? [])
        return arr.map((t) => normaliseSandboxThread('whatsapp', t))
      }),
    )
  }
  if (channel === 'all' || channel === 'instagram') {
    collectors.push(
      tryCallSandboxTool<
        { threads?: SandboxThreadShape[] } | SandboxThreadShape[] | SandboxFlatThreads
      >('instagram_list_dm_threads', {}).then((r) => {
        if (!r) { errors.push('instagram'); return [] }
        if (isFlatShape(r)) return buildThreadsFromFlat('instagram', r)
        const arr = Array.isArray(r) ? r : (r.threads ?? [])
        return arr.map((t) => normaliseSandboxThread('instagram', t))
      }),
    )
  }
  if (channel === 'all' || channel === 'web') {
    collectors.push(Promise.resolve(loadWebThreads()))
  }

  const lists = await Promise.all(collectors)
  let all = lists.flat()

  // Merge in our local outbound mirror — when the owner just sent a reply
  // (from TG chat OR the Mini App) but the sandbox hasn't echoed it back
  // yet, the row would otherwise show stale "customer-said" content with
  // bucket='new'. Override with the local truth.
  const latestOut = latestOutboundByThread()
  if (latestOut.size > 0) {
    all = all.map((t) => {
      if (t.channel === 'web') return t  // web outbound already in history_json
      const out = latestOut.get(`${t.channel}:${t.handle}`)
      if (!out) return t
      if (out.ts <= t.lastMessageAt) return t  // sandbox already shows newer
      return {
        ...t,
        lastMessage: out.text,
        lastMessageAt: out.ts,
        bucket: 'mine' as const,
      }
    })
  }

  all.sort((a, b) => b.lastMessageAt - a.lastMessageAt)

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
  // Two response shapes possible — see buildThreadsFromFlat note.
  const tool = channel === 'whatsapp' ? 'whatsapp_list_threads' : 'instagram_list_dm_threads'
  const r = await tryCallSandboxTool<
    { threads?: SandboxThreadShape[] } | SandboxThreadShape[] | SandboxFlatThreads
  >(tool, {})
  if (!r) {
    // Sandbox unreachable — synthesize a thread from our local outbound mirror
    // if the owner has been replying to this handle. Better than 404 in the
    // Mini App after a successful send.
    const localOut = listOutboundForThread(channel, id)
    if (localOut.length === 0) return null
    const last = localOut[localOut.length - 1]
    return {
      channel,
      id,
      handle: id,
      lastMessage: last.text,
      lastMessageAt: last.ts,
      bucket: 'mine',
      transcript: localOut.map((o) => ({ role: 'us' as const, text: o.text, at: o.ts })),
    }
  }

  // Flat-shape branch — the sandbox returned `{ inbound, outbound, simulated }`.
  // Build the transcript by filtering messages whose handle matches this id,
  // then merge local outbound the same way the per-thread branch does.
  if (isFlatShape(r)) {
    const norm = (s: string) => s.replace(/[^\w@]/g, '')
    const target = norm(id)
    const sandboxMessages = [
      ...(r.inbound ?? []).map((m) => ({ ...m, _dir: 'inbound' as const })),
      ...(r.outbound ?? []).map((m) => ({ ...m, _dir: 'outbound' as const })),
    ]
      .filter((m) => {
        const handle = m._dir === 'inbound' ? m.from : m.to
        const tid = m.threadId ?? m.thread_id
        return norm(String(handle ?? tid ?? '')) === target
      })
      .map((m) => ({
        role: (m._dir === 'inbound' ? 'customer' : 'us') as 'customer' | 'us',
        text: (m.message ?? m.text ?? m.body ?? '').toString(),
        at: toEpoch(m.ts),
      }))
      .sort((a, b) => a.at - b.at)

    if (sandboxMessages.length === 0) {
      const localOut = listOutboundForThread(channel, id)
      if (localOut.length === 0) return null
      const last = localOut[localOut.length - 1]
      return {
        channel,
        id,
        handle: id,
        lastMessage: last.text,
        lastMessageAt: last.ts,
        bucket: 'mine',
        transcript: localOut.map((o) => ({ role: 'us' as const, text: o.text, at: o.ts })),
      }
    }

    const localOut = listOutboundForThread(channel, id)
    const merged = [...sandboxMessages]
    for (const o of localOut) {
      const dupe = merged.some(
        (m) =>
          m.role === 'us' &&
          m.text.trim() === o.text.trim() &&
          Math.abs(m.at - o.ts) < 10_000,
      )
      if (!dupe) merged.push({ role: 'us', text: o.text, at: o.ts })
    }
    merged.sort((a, b) => a.at - b.at)
    const last = merged[merged.length - 1]
    return {
      channel,
      id,
      handle: id,
      lastMessage: last?.text ?? '',
      lastMessageAt: last?.at ?? 0,
      bucket: last?.role === 'us' ? 'mine' : 'new',
      transcript: merged,
    }
  }

  const arr = Array.isArray(r) ? r : (r.threads ?? [])
  const found = arr.find((t) => (t.threadId ?? t.id) === id)
  if (!found) {
    // Same fallback when the sandbox is reachable but doesn't know this id.
    const localOut = listOutboundForThread(channel, id)
    if (localOut.length === 0) return null
    const last = localOut[localOut.length - 1]
    return {
      channel,
      id,
      handle: id,
      lastMessage: last.text,
      lastMessageAt: last.ts,
      bucket: 'mine',
      transcript: localOut.map((o) => ({ role: 'us' as const, text: o.text, at: o.ts })),
    }
  }
  const base = normaliseSandboxThread(channel, found)
  const sandboxMessages = (found.messages ?? []).map((m) => {
    const dir = m.direction ?? (m.role === 'assistant' ? 'outbound' : 'inbound')
    const text = m.text ?? m.body ?? m.message ?? ''
    return {
      role: (dir === 'inbound' ? 'customer' : 'us') as 'customer' | 'us',
      text,
      at: toEpoch(m.at ?? m.ts ?? m.timestamp),
    }
  })

  // Merge in local outbound (Mini App / TG chat replies). De-dupe against
  // anything the sandbox already echoed back: same text within ±10s window
  // counts as the same message. Sandbox wins if it has the message.
  const localOut = listOutboundForThread(channel, base.handle)
  const merged = [...sandboxMessages]
  for (const o of localOut) {
    const dupe = merged.some(
      (m) =>
        m.role === 'us' &&
        m.text.trim() === o.text.trim() &&
        Math.abs(m.at - o.ts) < 10_000,
    )
    if (!dupe) merged.push({ role: 'us', text: o.text, at: o.ts })
  }
  merged.sort((a, b) => a.at - b.at)

  // Fallback — if neither sandbox nor local has anything, surface the snippet.
  if (merged.length === 0 && base.lastMessage) {
    merged.push({
      role: base.bucket === 'new' ? 'customer' : 'us',
      text: base.lastMessage,
      at: base.lastMessageAt,
    })
  }

  // If our local mirror is the freshest signal, override the header preview
  // so the listing-row matches the detail header.
  const latestLocal = localOut[localOut.length - 1]
  if (latestLocal && latestLocal.ts > base.lastMessageAt) {
    base.lastMessage = latestLocal.text
    base.lastMessageAt = latestLocal.ts
    base.bucket = 'mine'
  }

  return { ...base, transcript: merged }
}

export async function replyToInboxThread(
  channel: InboxChannel,
  id: string,
  text: string,
  source: 'mini_app' | 'tg_chat' | 'agent' = 'mini_app',
  tgChatId?: string,
): Promise<{
  ok: boolean
  channel: InboxChannel
  id: string
  error?: string
}> {
  if (channel === 'whatsapp') {
    // Use the dual-path adapter (Cloud API + sandbox) so real customer
    // numbers AND the rubric scorer both see the reply. The adapter
    // swallows individual-path failures; we only fail if BOTH paths
    // throw, which is rare.
    try {
      await whatsappAdapter.send(id, text)
    } catch (err) {
      return { ok: false, channel, id, error: (err as Error).message }
    }
    recordOutbound({ channel: 'whatsapp', handle: id, text, source, tg_chat_id: tgChatId })
    return { ok: true, channel, id }
  }
  if (channel === 'instagram') {
    try {
      await instagramAdapter.send(id, text)
    } catch (err) {
      return { ok: false, channel, id, error: (err as Error).message }
    }
    recordOutbound({ channel: 'instagram', handle: id, text, source, tg_chat_id: tgChatId })
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
  recordOutbound({ channel: 'web', handle: id, text, source, tg_chat_id: tgChatId })
  return { ok: true, channel: 'web', id }
}
