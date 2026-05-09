// Thread + history persistence. One row per (channel, threadId).

import { getDb } from './db.ts'
import type { Channel } from '../channels/types.ts'

export interface HistoryEntry {
  role: 'user' | 'assistant'
  content: string
  ts: number
}

export function loadHistory(threadId: string): HistoryEntry[] {
  const row = getDb()
    .prepare('SELECT history_json FROM threads WHERE thread_id = ?')
    .get(threadId) as { history_json: string } | undefined
  if (!row) return []
  try {
    return JSON.parse(row.history_json) as HistoryEntry[]
  } catch {
    return []
  }
}

export function saveHistory(
  threadId: string,
  channel: Channel,
  history: HistoryEntry[],
  senderName?: string,
  senderId?: string,
) {
  const now = Date.now()
  const json = JSON.stringify(history)
  getDb()
    .prepare(
      `INSERT INTO threads (thread_id, channel, sender_id, sender_name, history_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(thread_id) DO UPDATE SET
         history_json = excluded.history_json,
         sender_name = COALESCE(excluded.sender_name, sender_name),
         updated_at = excluded.updated_at`,
    )
    .run(threadId, channel, senderId ?? null, senderName ?? null, json, now, now)
}

export function trimHistory(history: HistoryEntry[], maxTurns = 12): HistoryEntry[] {
  if (history.length <= maxTurns * 2) return history
  return history.slice(-maxTurns * 2)
}
