// SQLite implementation of ContentRepository. bun:sqlite, same DB handle as
// the rest of the app. JSON columns use the standard "stringify on write,
// parse on read" pattern.

import { getDb } from '../../db/db.ts'
import type {
  BrandCheck,
  ContentDraft,
  DraftChannel,
  DraftKind,
  DraftStatus,
  PlanSlot,
  PublishReceipt,
  ReelBrief,
  SlotStatus,
} from './entities.ts'
import type {
  ContentRepository,
  DraftFilter,
  ScheduledDueFilter,
} from './repository.ts'

interface DraftRow {
  id: string
  kind: string
  channel: string
  status: string
  caption: string | null
  brief_json: string | null
  media_urls: string | null
  sku_refs: string | null
  brand_check_json: string | null
  owner_note: string | null
  scheduled_for: number | null
  publish_receipt_json: string | null
  tg_card_msg_id: number | null
  source_intent: string | null
  slot_id: string | null
  created_at: number
  updated_at: number
}

interface SlotRow {
  id: string
  iso_week: string
  day_of_week: number
  hour: number
  channel: string
  kind: string
  topic_hint: string | null
  draft_id: string | null
  status: string
  created_at: number
  updated_at: number
}

function rowToDraft(r: DraftRow): ContentDraft {
  return {
    id: r.id,
    kind: r.kind as DraftKind,
    channel: r.channel as DraftChannel,
    status: r.status as DraftStatus,
    caption: r.caption ?? '',
    brief: r.brief_json ? (JSON.parse(r.brief_json) as ReelBrief) : null,
    media_urls: r.media_urls ? r.media_urls.split(',').filter(Boolean) : [],
    sku_refs: r.sku_refs ? r.sku_refs.split(',').filter(Boolean) : [],
    brand_check: r.brand_check_json ? (JSON.parse(r.brand_check_json) as BrandCheck) : null,
    owner_note: r.owner_note,
    scheduled_for: r.scheduled_for,
    publish_receipt: r.publish_receipt_json
      ? (JSON.parse(r.publish_receipt_json) as PublishReceipt)
      : null,
    tg_card_msg_id: r.tg_card_msg_id,
    source_intent: r.source_intent,
    slot_id: r.slot_id,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }
}

function rowToSlot(r: SlotRow): PlanSlot {
  return {
    id: r.id,
    iso_week: r.iso_week,
    day_of_week: r.day_of_week,
    hour: r.hour,
    channel: r.channel as DraftChannel,
    kind: r.kind as DraftKind,
    topic_hint: r.topic_hint,
    draft_id: r.draft_id,
    status: r.status as SlotStatus,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }
}

export class SqliteContentRepository implements ContentRepository {
  saveDraft(d: ContentDraft): void {
    getDb()
      .prepare(
        `INSERT INTO content_drafts (
          id, kind, channel, status, caption, brief_json, media_urls, sku_refs,
          brand_check_json, owner_note, scheduled_for, publish_receipt_json,
          tg_card_msg_id, source_intent, slot_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          kind = excluded.kind,
          channel = excluded.channel,
          status = excluded.status,
          caption = excluded.caption,
          brief_json = excluded.brief_json,
          media_urls = excluded.media_urls,
          sku_refs = excluded.sku_refs,
          brand_check_json = excluded.brand_check_json,
          owner_note = excluded.owner_note,
          scheduled_for = excluded.scheduled_for,
          publish_receipt_json = excluded.publish_receipt_json,
          tg_card_msg_id = excluded.tg_card_msg_id,
          source_intent = excluded.source_intent,
          slot_id = excluded.slot_id,
          updated_at = excluded.updated_at`,
      )
      .run(
        d.id,
        d.kind,
        d.channel,
        d.status,
        d.caption,
        d.brief ? JSON.stringify(d.brief) : null,
        d.media_urls.join(','),
        d.sku_refs.join(','),
        d.brand_check ? JSON.stringify(d.brand_check) : null,
        d.owner_note,
        d.scheduled_for,
        d.publish_receipt ? JSON.stringify(d.publish_receipt) : null,
        d.tg_card_msg_id,
        d.source_intent,
        d.slot_id,
        d.created_at,
        d.updated_at,
      )
  }

  getDraft(id: string): ContentDraft | null {
    const row = getDb()
      .prepare('SELECT * FROM content_drafts WHERE id = ?')
      .get(id) as DraftRow | undefined
    return row ? rowToDraft(row) : null
  }

  listDrafts(filter: DraftFilter): ContentDraft[] {
    const where: string[] = []
    const params: Array<string | number> = []
    if (filter.status) {
      const arr = Array.isArray(filter.status) ? filter.status : [filter.status]
      where.push(`status IN (${arr.map(() => '?').join(',')})`)
      params.push(...arr)
    }
    if (filter.kind) {
      where.push('kind = ?')
      params.push(filter.kind)
    }
    if (filter.channel) {
      where.push('channel = ?')
      params.push(filter.channel)
    }
    const sql = `SELECT * FROM content_drafts ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY updated_at DESC LIMIT ?`
    params.push(filter.limit ?? 50)
    const rows = getDb().prepare(sql).all(...params) as DraftRow[]
    return rows.map(rowToDraft)
  }

  listScheduledDue(filter: ScheduledDueFilter): ContentDraft[] {
    const rows = getDb()
      .prepare(
        `SELECT * FROM content_drafts
         WHERE status = 'scheduled' AND scheduled_for IS NOT NULL AND scheduled_for <= ?
         ORDER BY scheduled_for ASC LIMIT ?`,
      )
      .all(filter.upTo, filter.limit ?? 20) as DraftRow[]
    return rows.map(rowToDraft)
  }

  saveSlot(s: PlanSlot): void {
    getDb()
      .prepare(
        `INSERT INTO content_plan_slots (
          id, iso_week, day_of_week, hour, channel, kind, topic_hint,
          draft_id, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          iso_week = excluded.iso_week,
          day_of_week = excluded.day_of_week,
          hour = excluded.hour,
          channel = excluded.channel,
          kind = excluded.kind,
          topic_hint = excluded.topic_hint,
          draft_id = excluded.draft_id,
          status = excluded.status,
          updated_at = excluded.updated_at`,
      )
      .run(
        s.id,
        s.iso_week,
        s.day_of_week,
        s.hour,
        s.channel,
        s.kind,
        s.topic_hint,
        s.draft_id,
        s.status,
        s.created_at,
        s.updated_at,
      )
  }

  getSlot(id: string): PlanSlot | null {
    const row = getDb()
      .prepare('SELECT * FROM content_plan_slots WHERE id = ?')
      .get(id) as SlotRow | undefined
    return row ? rowToSlot(row) : null
  }

  listSlotsForWeek(iso_week: string): PlanSlot[] {
    const rows = getDb()
      .prepare(
        `SELECT * FROM content_plan_slots
         WHERE iso_week = ? ORDER BY day_of_week, hour`,
      )
      .all(iso_week) as SlotRow[]
    return rows.map(rowToSlot)
  }

  listSlotsForChannel(channel: string, isoWeek: string): PlanSlot[] {
    const rows = getDb()
      .prepare(
        `SELECT * FROM content_plan_slots
         WHERE iso_week = ? AND channel = ? ORDER BY day_of_week, hour`,
      )
      .all(isoWeek, channel) as SlotRow[]
    return rows.map(rowToSlot)
  }
}
