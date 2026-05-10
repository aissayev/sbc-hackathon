// Pure rendering — no I/O, no DB, no TG calls. Translates content-studio
// domain types to plain-text strings + inline-keyboard rows.
//
// Why pure: tests don't need a Telegram mock; future channels (web admin,
// CLI tool) can reuse the same renderer.

import { fmtMoney as _fmtMoney, hhmm, shortId } from '../format.ts'
import type {
  BrandCheck,
  ContentDraft,
  DraftChannel,
  DraftKind,
  PlanSlot,
} from '../../../domain/content-studio/index.ts'

void _fmtMoney // kept available for future budget/spend lines

export interface KeyboardButton {
  text: string
  data: string
}

const CHANNEL_LABEL: Record<DraftChannel, string> = {
  ig: 'Instagram',
  fb: 'Facebook',
  gbp: 'Google Business',
  wa: 'WhatsApp',
  multi: 'IG + FB',
}

const KIND_LABEL: Record<DraftKind, string> = {
  post: 'post',
  reel: 'reel',
  story: 'story',
  gbp_post: 'GBP post',
  comment_reply: 'comment reply',
  review_reply: 'review reply',
  wa_broadcast: 'WA broadcast',
}

const STATUS_GLYPH: Record<ContentDraft['status'], string> = {
  draft: '✏️',
  brand_pending: '⚠️',
  approved: '✓',
  scheduled: '📅',
  publishing: '⏳',
  published: '🚀',
  failed: '❌',
  discarded: '🗑',
  expired: '⌛',
}

const SLOT_GLYPH: Record<PlanSlot['status'], string> = {
  pending: '·',
  drafted: '✏️',
  approved: '✓',
  published: '🚀',
  skipped: '—',
}

const DAY_LABEL = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ─── Brand check ─────────────────────────────────────────────────────────

export function renderBrandCheck(check: BrandCheck | null): string {
  if (!check) return 'brand: not yet checked'
  if (check.issues.length === 0) return `brand ✓ score ${check.score}/100`
  const lines: string[] = [`brand: score ${check.score}/100`]
  for (const issue of check.issues) {
    const glyph = issue.severity === 'block' ? '✗' : '⚠'
    const fixHint = issue.fix ? `  → ${issue.fix}` : ''
    lines.push(`${glyph} ${issue.msg}${fixHint}`)
  }
  return lines.join('\n')
}

// ─── Draft card ──────────────────────────────────────────────────────────
// The owner's primary view of one in-flight piece of content. Inline
// keyboard offers the next-step actions based on current status.

export interface DraftCardView {
  text: string
  keyboard: KeyboardButton[][]
}

export function renderDraftCard(draft: ContentDraft): DraftCardView {
  const header =
    `${STATUS_GLYPH[draft.status]} ${KIND_LABEL[draft.kind]} · ${CHANNEL_LABEL[draft.channel]} · ${shortId(draft.id)}`

  const captionPreview = draft.caption.length > 600
    ? draft.caption.slice(0, 600) + '…'
    : draft.caption

  const meta: string[] = [`length: ${draft.caption.length} chars`]
  if (draft.media_urls.length > 0) meta.push(`${draft.media_urls.length} media`)
  if (draft.sku_refs.length > 0) meta.push(`SKUs: ${draft.sku_refs.join(', ')}`)
  if (draft.scheduled_for) meta.push(`scheduled ${new Date(draft.scheduled_for).toISOString().slice(0, 16).replace('T', ' ')}`)

  const lines: string[] = [
    header,
    '',
    captionPreview,
    '',
    renderBrandCheck(draft.brand_check),
    meta.join(' · '),
  ]

  if (draft.publish_receipt) {
    lines.push('', `published via ${draft.publish_receipt.tool} · remote_id ${draft.publish_receipt.remote_id ?? '—'}`)
  }

  return {
    text: lines.join('\n'),
    keyboard: keyboardForStatus(draft),
  }
}

function keyboardForStatus(draft: ContentDraft): KeyboardButton[][] {
  const id = draft.id
  switch (draft.status) {
    case 'draft':
    case 'brand_pending':
      return [
        [
          { text: '✏️ Edit', data: `cs_edit:${id}` },
          { text: '🔁 Regenerate', data: `cs_regen:${id}` },
        ],
        [
          { text: '✅ Approve', data: `cs_approve:${id}` },
          { text: '📅 Schedule', data: `cs_sched:${id}` },
          { text: '🚀 Publish', data: `cs_pub:${id}` },
        ],
        [{ text: '❌ Discard', data: `cs_discard:${id}` }],
      ]
    case 'approved':
      return [
        [
          { text: '📅 Schedule', data: `cs_sched:${id}` },
          { text: '🚀 Publish now', data: `cs_pub:${id}` },
        ],
        [
          { text: '✏️ Edit', data: `cs_edit:${id}` },
          { text: '❌ Discard', data: `cs_discard:${id}` },
        ],
      ]
    case 'scheduled':
      return [
        [
          { text: '🚀 Publish now', data: `cs_pub:${id}` },
          { text: '✏️ Edit', data: `cs_edit:${id}` },
          { text: '❌ Cancel', data: `cs_discard:${id}` },
        ],
      ]
    case 'failed':
      return [
        [
          { text: '🔁 Retry', data: `cs_pub:${id}` },
          { text: '✏️ Edit', data: `cs_edit:${id}` },
          { text: '❌ Discard', data: `cs_discard:${id}` },
        ],
      ]
    case 'published':
      return [[{ text: '📊 Drafts', data: `cs_list` }]]
    default:
      return []
  }
}

// ─── Schedule picker ─────────────────────────────────────────────────────

export function renderSchedulePicker(draft: ContentDraft): DraftCardView {
  const id = draft.id
  return {
    text: `When should "${shortId(id)}" go live?`,
    keyboard: [
      [
        { text: 'In 1 hour', data: `cs_sched_at:${id}:1h` },
        { text: 'Today 5 PM', data: `cs_sched_at:${id}:today_17` },
        { text: 'Tomorrow 9 AM', data: `cs_sched_at:${id}:tomorrow_09` },
      ],
      [
        { text: 'Tomorrow noon', data: `cs_sched_at:${id}:tomorrow_12` },
        { text: 'Saturday 10 AM', data: `cs_sched_at:${id}:saturday_10` },
      ],
      [{ text: '◀ Back', data: `cs_open:${id}` }],
    ],
  }
}

// ─── Plan week view ──────────────────────────────────────────────────────

export interface PlanWeekView {
  text: string
  keyboard: KeyboardButton[][]
}

export function renderPlanWeek(
  isoWeek: string,
  slots: PlanSlot[],
  drafts: Map<string, ContentDraft>,
): PlanWeekView {
  const lines: string[] = [`📅 Content plan — ${isoWeek}`]

  if (slots.length === 0) {
    lines.push('', 'No slots seeded yet.')
    return {
      text: lines.join('\n'),
      keyboard: [[{ text: '➕ Seed default rhythm', data: 'cs_seed_week' }]],
    }
  }

  const byDay = new Map<number, PlanSlot[]>()
  for (const s of slots) {
    const arr = byDay.get(s.day_of_week) ?? []
    arr.push(s)
    byDay.set(s.day_of_week, arr)
  }

  for (let d = 0; d < 7; d++) {
    const daySlots = byDay.get(d) ?? []
    if (daySlots.length === 0) {
      lines.push(`${DAY_LABEL[d]}  —`)
      continue
    }
    for (const s of daySlots) {
      const t = `${String(s.hour).padStart(2, '0')}:00`
      const linked = s.draft_id ? drafts.get(s.draft_id) : undefined
      const head = linked
        ? `"${(linked.caption || s.topic_hint || '').slice(0, 40)}"`
        : s.topic_hint ?? KIND_LABEL[s.kind]
      lines.push(`${DAY_LABEL[d]}  ${t}  ${SLOT_GLYPH[s.status]} ${CHANNEL_LABEL[s.channel]} · ${head}`)
    }
  }

  const filled = slots.filter((s) => s.status !== 'pending' && s.status !== 'skipped').length
  const target = 5
  lines.push('', `Cadence: ${filled}/${slots.length} slots filled · target ${target}/week`)

  return {
    text: lines.join('\n'),
    keyboard: [
      [
        { text: '➕ New post', data: 'cs_new:post' },
        { text: '🎬 New reel', data: 'cs_new:reel' },
      ],
      [
        { text: '📋 Drafts', data: 'cs_list' },
        { text: '📊 Stats', data: 'cs_stats' },
      ],
    ],
  }
}

// ─── Drafts list ─────────────────────────────────────────────────────────

export function renderDraftsList(drafts: ContentDraft[]): DraftCardView {
  if (drafts.length === 0) {
    return {
      text: 'No active drafts. Type "make a post about …" to start one.',
      keyboard: [
        [
          { text: '➕ New post', data: 'cs_new:post' },
          { text: '📅 Plan', data: 'cs_plan' },
        ],
      ],
    }
  }
  const lines: string[] = [`📋 Drafts (${drafts.length})`]
  for (const d of drafts.slice(0, 10)) {
    const preview = d.caption ? d.caption.slice(0, 60) : '(empty)'
    lines.push(
      `${STATUS_GLYPH[d.status]} ${shortId(d.id)} · ${KIND_LABEL[d.kind]} · ${CHANNEL_LABEL[d.channel]} · ${hhmm(d.updated_at)} — ${preview}`,
    )
  }
  return {
    text: lines.join('\n'),
    keyboard: drafts.slice(0, 5).map((d) => [
      { text: `Open ${shortId(d.id)}`, data: `cs_open:${d.id}` },
    ]),
  }
}
