// Engagement cockpit — DM inbox + review inbox with drafted replies.
//
// Flow:
//   1. /comments or /reviews — pull items via sandbox MCP, render with
//      sentiment glyph + handle + last message, plus a "Draft replies" tap.
//   2. Owner taps Draft → claude -p drafts a per-item reply (kind=
//      comment_reply / review_reply), brand-checked, stored as a
//      ContentDraft, card shown with Approve / Edit / Skip.
//   3. Approve → sandbox adapter posts the reply; receipt stored on draft.
//
// Risk-flagged items (sentiment.risk = true) are NEVER auto-drafted: they
// escalate to the owner with a "Reply personally" hint.

import { sendTelegram, editTelegramMessage } from '../../../channels/telegram.ts'
import { config } from '../../../config.ts'
import {
  listDmInbox,
  listReviewInbox,
  sentimentGlyph,
  summariseSentiment,
  type EngagementItem,
} from '../../../domain/engagement/index.ts'
import { draftCaption } from '../../../agent/drafter.ts'
import { draftService } from './post-studio.ts'
import { renderDraftCard } from './presenter.ts'
import { getAdapter } from '../../../agent/mcp/adapters/index.ts'
import { shortId } from '../format.ts'
import type { DraftKind } from '../../../domain/content-studio/index.ts'

export interface BotReply {
  text: string
  keyboard?: Array<Array<{ text: string; data: string }>>
}

const TRUNC = 60

function truncate(s: string, n = TRUNC): string {
  if (!s) return '(empty)'
  return s.length > n ? s.slice(0, n).trim() + '…' : s
}

function stars(n: number | null): string {
  if (n == null) return '— star'
  const f = Math.max(0, Math.min(5, Math.round(n)))
  return '★'.repeat(f) + '☆'.repeat(5 - f)
}

// ─── /comments — DM inbox ────────────────────────────────────────────────

export async function handleCommentsCommand(): Promise<BotReply> {
  const items = await listDmInbox()
  if (items.length === 0) {
    return { text: '✅ Inbox empty — no open WA or IG threads.' }
  }
  const summary = summariseSentiment(items)
  const lines: string[] = [
    `📥 Engagement inbox — ${items.length} item${items.length === 1 ? '' : 's'}`,
    `   ${summary.unhandled} unhandled · 💚 ${summary.positive} · ⚠️ ${summary.negative} · 🚨 ${summary.risk}`,
    '',
  ]
  const buttons: Array<Array<{ text: string; data: string }>> = []
  for (const item of items.slice(0, 8)) {
    const platform = item.source === 'wa_dm' ? '📱 WA' : '📷 IG'
    const handle = item.author_handle ?? 'unknown'
    const repliedFlag = item.has_reply ? ' ✓' : ''
    lines.push(
      `${sentimentGlyph(item.sentiment.label)} ${platform} ${handle}${repliedFlag}`,
    )
    lines.push(`   "${truncate(item.text, 70)}"`)
    if (!item.has_reply && !item.sentiment.risk) {
      buttons.push([
        {
          text: `✏️ Draft reply ${platform} ${shortId(item.remote_id)}`,
          data: `eg_draft:${item.source}:${item.remote_id}`,
        },
      ])
    } else if (item.sentiment.risk) {
      buttons.push([
        {
          text: `🚨 Risk — open ${shortId(item.remote_id)}`,
          data: `eg_open:${item.source}:${item.remote_id}`,
        },
      ])
    }
  }
  if (buttons.length > 1) {
    buttons.push([{ text: '✅ Draft all (positive only)', data: 'eg_draft_bulk' }])
  }
  return { text: lines.join('\n'), keyboard: buttons.slice(0, 8) }
}

// ─── /reviews-rich — replaces /reviews when called via this module ──────

export async function handleReviewsCommand(): Promise<BotReply> {
  const items = await listReviewInbox()
  if (items.length === 0) {
    return { text: 'No recent Google Business reviews.' }
  }
  const lines: string[] = [`⭐ Reviews — ${items.length}`, '']
  const buttons: Array<Array<{ text: string; data: string }>> = []
  for (const item of items.slice(0, 8)) {
    const author = item.author_name ?? '?'
    const replied = item.has_reply ? ' ✓ replied' : ''
    lines.push(
      `${stars(item.rating)} ${sentimentGlyph(item.sentiment.label)} ${author}${replied}`,
    )
    lines.push(`   "${truncate(item.text, 70)}"`)
    if (!item.has_reply) {
      buttons.push([
        {
          text: `✏️ Draft reply ${stars(item.rating)} ${shortId(item.remote_id)}`,
          data: `eg_draft:gbp_review:${item.remote_id}`,
        },
      ])
    }
  }
  return { text: lines.join('\n'), keyboard: buttons.slice(0, 8) }
}

// ─── eg_* callbacks ──────────────────────────────────────────────────────

export async function handleEngagementCallback(data: string, chatId: string): Promise<boolean> {
  const token = config.telegram.owner.token
  if (!token) return false
  const m = /^eg_([a-z_]+)(?::(.+))?$/.exec(data)
  if (!m) return false
  const action = m[1]
  const tail = m[2]
  switch (action) {
    case 'draft': {
      if (!tail) return false
      const [source, ...rest] = tail.split(':')
      const remoteId = rest.join(':')
      return draftReplyFor(source, remoteId, chatId, token)
    }
    case 'open': {
      if (!tail) return false
      const [source, ...rest] = tail.split(':')
      const remoteId = rest.join(':')
      const item = await findItem(source, remoteId)
      if (!item) {
        await sendTelegram(token, chatId, `couldn't find ${source} ${remoteId}`)
        return true
      }
      await sendTelegram(
        token,
        chatId,
        [
          `${sentimentGlyph(item.sentiment.label)} ${item.source} ${item.author_handle ?? '?'}`,
          item.rating != null ? stars(item.rating) : '',
          '',
          item.text,
          '',
          item.sentiment.risk
            ? '🚨 Risk-flagged. Auto-draft is disabled — Askhat replies personally.'
            : `Sentiment: ${item.sentiment.label} (${item.sentiment.score.toFixed(2)})`,
        ].filter(Boolean).join('\n'),
      )
      return true
    }
    case 'send': {
      if (!tail) return false
      return sendDraftedReply(tail, chatId, token)
    }
    case 'draft_bulk':
      await sendTelegram(
        token,
        chatId,
        'Bulk drafting all positive items — coming in Phase 4 (one tap per LLM call costs real $).',
      )
      return true
    default:
      return false
  }
}

async function findItem(source: string, remoteId: string): Promise<EngagementItem | null> {
  const items =
    source === 'gbp_review' ? await listReviewInbox() :
    source === 'wa_dm' || source === 'ig_dm' ? await listDmInbox() :
    []
  return items.find((i) => i.remote_id === remoteId) ?? null
}

async function draftReplyFor(
  source: string,
  remoteId: string,
  chatId: string,
  token: string,
): Promise<boolean> {
  const item = await findItem(source, remoteId)
  if (!item) {
    await sendTelegram(token, chatId, `couldn't find ${source} ${remoteId}`)
    return true
  }
  if (item.sentiment.risk) {
    await sendTelegram(
      token,
      chatId,
      `🚨 Risk-flagged — drafting disabled. Reply personally:\n\n"${item.text}"`,
    )
    return true
  }

  const placeholder = await sendTelegram(token, chatId, '✏️ drafting reply…')
  const kind: DraftKind =
    item.source === 'gbp_review' ? 'review_reply' : 'comment_reply'
  const channel =
    item.source === 'gbp_review' ? 'gbp' :
    item.source === 'ig_dm' ? 'ig' : 'wa'

  const intent = buildIntentFor(item)
  const result = await draftCaption({ intent, kind })
  if (!result.ok) {
    await sendTelegram(token, chatId, `couldn't draft: ${result.error ?? 'unknown'}`)
    return true
  }

  const draft = draftService.create({
    kind,
    channel,
    caption: result.caption,
    source_intent: `reply to ${item.source} ${item.remote_id}: "${item.text.slice(0, 80)}"`,
  })

  const card = renderDraftCard(draft)
  const sendBtnRow = [{ text: '🚀 Send reply', data: `eg_send:${draft.id}:${item.source}:${item.remote_id}` }]
  const enrichedKeyboard = [sendBtnRow, ...card.keyboard]
  if (placeholder) {
    await editTelegramMessage(token, chatId, placeholder, card.text, enrichedKeyboard)
  } else {
    await sendTelegram(token, chatId, card.text, enrichedKeyboard)
  }
  return true
}

function buildIntentFor(item: EngagementItem): string {
  const author = item.author_name ?? item.author_handle ?? 'this customer'
  const ratingHint = item.rating != null ? ` (${item.rating}/5 star review)` : ''
  return [
    `Customer ${author} wrote${ratingHint}:`,
    `"${item.text.trim()}"`,
    '',
    item.source === 'gbp_review'
      ? 'Reply on Google Business Profile in Askhat\'s voice — warm, direct, no discount offer.'
      : 'Reply in DM in HappyCake voice — short, friendly, soft CTA only if it fits.',
  ].join('\n')
}

async function sendDraftedReply(
  tail: string,
  chatId: string,
  token: string,
): Promise<boolean> {
  // tail = `<draft_id>:<source>:<remote_id>` (split with care: remote_id may
  // contain a colon).
  const firstColon = tail.indexOf(':')
  const secondColon = tail.indexOf(':', firstColon + 1)
  if (firstColon < 0 || secondColon < 0) {
    await sendTelegram(token, chatId, `couldn't parse send target: ${tail}`)
    return true
  }
  const draftId = tail.slice(0, firstColon)
  const source = tail.slice(firstColon + 1, secondColon)
  const remoteId = tail.slice(secondColon + 1)

  const draft = draftService.get(draftId)
  if (!draft) {
    await sendTelegram(token, chatId, `draft ${draftId} not found`)
    return true
  }
  if (draft.brand_check && !draft.brand_check.ok) {
    await sendTelegram(token, chatId, `brand check has blockers — fix the caption first`)
    return true
  }

  await sendTelegram(token, chatId, '⏳ sending via sandbox MCP…')
  let ok = false
  let error: string | undefined
  try {
    if (source === 'gbp_review') {
      const adapter = getAdapter('gbp')
      const r = await adapter.reply_to_review!({
        review_remote_id: remoteId,
        reply_text: draft.caption,
      })
      ok = r.ok
      error = r.error
    } else if (source === 'ig_dm') {
      const adapter = getAdapter('ig')
      const r = await adapter.reply_to_comment!({
        comment_remote_id: remoteId,
        reply_text: draft.caption,
      })
      ok = r.ok
      error = r.error
    } else if (source === 'wa_dm') {
      // WA DM goes via the channel adapter, not the publish adapter.
      // For the hackathon we route through whatsapp_send.
      const { whatsappAdapter } = await import('../../../channels/whatsapp.ts')
      await whatsappAdapter.send(remoteId, draft.caption)
      ok = true
    }
  } catch (e) {
    ok = false
    error = (e as Error).message
  }

  if (ok) {
    await sendTelegram(token, chatId, `🚀 sent · ${shortId(remoteId)}`)
  } else {
    await sendTelegram(token, chatId, `❌ send failed: ${error ?? 'unknown'}`)
  }
  return true
}
