// Local mirror of owner-sent replies on inbox threads.
//
// Every time the owner sends a reply to a WA / IG / web thread — whether
// from the Telegram bot chat or the admin Mini App — we record one row
// here. The unified inbox merges these rows into both:
//   - listInboxThreads()  → last-message snapshot if newer than sandbox
//   - getInboxThread()    → transcript bubbles, chronologically merged
//
// The sandbox is still the source of truth for inbound + the eventual
// echo of outbound. This mirror just closes the visibility gap until
// the sandbox returns the outbound on its next list call.

import { getDb } from '../db/db.ts'

export interface InboxOutboundRow {
  id: string
  channel: 'whatsapp' | 'instagram' | 'web'
  handle: string
  text: string
  source: 'mini_app' | 'tg_chat' | 'agent'
  tg_chat_id: string | null
  ts: number
}

function genId(): string {
  const ms = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 8)
  return `out_${ms}_${rand}`
}

export function recordOutbound(args: {
  channel: 'whatsapp' | 'instagram' | 'web'
  handle: string
  text: string
  source: 'mini_app' | 'tg_chat' | 'agent'
  tg_chat_id?: string | null
}): InboxOutboundRow {
  const row: InboxOutboundRow = {
    id: genId(),
    channel: args.channel,
    handle: args.handle,
    text: args.text,
    source: args.source,
    tg_chat_id: args.tg_chat_id ?? null,
    ts: Date.now(),
  }
  getDb()
    .prepare(
      `INSERT INTO inbox_outbound (id, channel, handle, text, source, tg_chat_id, ts)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(row.id, row.channel, row.handle, row.text, row.source, row.tg_chat_id, row.ts)
  return row
}

/** Fetch outbound rows for a single (channel, handle) thread, oldest first. */
export function listOutboundForThread(
  channel: 'whatsapp' | 'instagram' | 'web',
  handle: string,
): InboxOutboundRow[] {
  return getDb()
    .prepare(
      `SELECT id, channel, handle, text, source, tg_chat_id, ts
       FROM inbox_outbound
       WHERE channel = ? AND handle = ?
       ORDER BY ts ASC`,
    )
    .all(channel, handle) as InboxOutboundRow[]
}

/**
 * Latest outbound per (channel, handle) — used by listInboxThreads to
 * decide whether the local mirror is fresher than the sandbox snapshot.
 */
export function latestOutboundByThread(): Map<string, InboxOutboundRow> {
  const rows = getDb()
    .prepare(
      `SELECT o.id, o.channel, o.handle, o.text, o.source, o.tg_chat_id, o.ts
       FROM inbox_outbound o
       JOIN (
         SELECT channel, handle, MAX(ts) as max_ts
         FROM inbox_outbound
         GROUP BY channel, handle
       ) m ON m.channel = o.channel AND m.handle = o.handle AND m.max_ts = o.ts`,
    )
    .all() as InboxOutboundRow[]
  const map = new Map<string, InboxOutboundRow>()
  for (const r of rows) {
    map.set(`${r.channel}:${r.handle}`, r)
  }
  return map
}
