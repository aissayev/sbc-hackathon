// Post studio — orchestrates free-text intent → drafted caption → owner card.
//
// Lives between the TG transport (sendTelegram / editTelegramMessage) and
// the content-studio domain. Has no DB knowledge of its own — calls into
// DraftService for persistence + lifecycle.
//
// Free-text intent detection is a tiny regex matcher. If the owner's message
// matches the post-intent shape ("make a post …", "draft a reel …",
// "post about …"), we return a result object the router can act on. Anything
// else falls through to the regular agent path.

import { sendTelegram, editTelegramMessage } from '../../../channels/telegram.ts'
import { config } from '../../../config.ts'
import { draftCaption } from '../../../agent/drafter.ts'
import {
  DraftService,
  SqliteContentRepository,
  PlanService,
  isoWeekOf,
  type ContentDraft,
  type DraftKind,
  type DraftChannel,
} from '../../../domain/content-studio/index.ts'
import {
  renderDraftCard,
  renderSchedulePicker,
  renderPlanWeek,
  renderDraftsList,
} from './presenter.ts'

// ─── Service singletons ──────────────────────────────────────────────────
// One repository instance per process is plenty; bun:sqlite handles
// concurrency. Exposed for tests to swap.

const repo = new SqliteContentRepository()
export const draftService = new DraftService(repo)
export const planService = new PlanService(repo)

// ─── Free-text intent matcher ────────────────────────────────────────────

const INTENT_RE =
  /^(?:can you |please |go )?(?:make|draft|write|create|generate)\s+(?:a |an )?(post|reel|story|gbp\s*post|gbp|broadcast|wa\s*broadcast)\s+(?:about\s+|on\s+|for\s+)?(.+)$/i

const SHORT_INTENT_RE =
  /^(?:post|reel|story)\s+(?:about\s+|on\s+|for\s+)(.+)$/i

export interface PostIntent {
  kind: DraftKind
  channel: DraftChannel
  intent: string
}

export function matchPostIntent(text: string): PostIntent | null {
  const trimmed = text.trim()
  let kind: DraftKind | null = null
  let intent: string | null = null

  const m = INTENT_RE.exec(trimmed)
  if (m) {
    kind = normaliseKind(m[1])
    intent = m[2].trim()
  } else {
    const sm = SHORT_INTENT_RE.exec(trimmed)
    if (sm) {
      kind = normaliseKind(sm[0].split(/\s+/)[0])
      intent = sm[1].trim()
    }
  }
  if (!kind || !intent) return null

  // Channel inference: GBP posts are gbp; WA broadcasts are wa; everything
  // else defaults to multi (IG + FB cross-post). Owner can edit channel
  // before publish.
  const channel: DraftChannel =
    kind === 'gbp_post' ? 'gbp' :
    kind === 'wa_broadcast' ? 'wa' :
    'multi'

  return { kind, channel, intent }
}

function normaliseKind(raw: string): DraftKind | null {
  const k = raw.toLowerCase().replace(/\s+/g, '_')
  if (k === 'post' || k === 'reel' || k === 'story') return k
  if (k === 'gbp_post' || k === 'gbp') return 'gbp_post'
  if (k === 'broadcast' || k === 'wa_broadcast') return 'wa_broadcast'
  return null
}

// ─── Studio actions ─────────────────────────────────────────────────────

export interface StudioCallContext {
  token: string
  chatId: string
  /** TG message id of the placeholder we're live-editing while the LLM
   *  drafts the caption. If absent, we sendTelegram instead. */
  thinkingMsgId?: number | null
}

/** Owner asked for a fresh draft — draft via claude -p, save, send card. */
export async function startDraft(
  intent: PostIntent,
  ctx: StudioCallContext,
): Promise<ContentDraft | null> {
  // Live-edit the placeholder message so the owner sees progress.
  await live(ctx, '🎨 drafting…')

  const result = await draftCaption({
    intent: intent.intent,
    kind: intent.kind,
    sku_hint: extractSkuHint(intent.intent),
  })

  if (!result.ok) {
    await live(ctx, `couldn't draft (${result.error ?? 'unknown'}). Try again?`)
    return null
  }

  const draft = draftService.create({
    kind: intent.kind,
    channel: intent.channel,
    caption: result.caption,
    sku_refs: extractSkuHint(intent.intent),
    source_intent: intent.intent,
  })

  const card = renderDraftCard(draft)
  if (ctx.thinkingMsgId) {
    const ok = await editTelegramMessage(ctx.token, ctx.chatId, ctx.thinkingMsgId, card.text, card.keyboard)
    if (!ok) {
      const newId = await sendTelegram(ctx.token, ctx.chatId, card.text, card.keyboard)
      if (newId) draftService.attachTgCardId(draft.id, newId)
    } else {
      draftService.attachTgCardId(draft.id, ctx.thinkingMsgId)
    }
  } else {
    const newId = await sendTelegram(ctx.token, ctx.chatId, card.text, card.keyboard)
    if (newId) draftService.attachTgCardId(draft.id, newId)
  }
  return draft
}

/** Owner tapped Approve / Schedule / Discard / etc. */
export async function handleStudioCallback(data: string, chatId: string): Promise<boolean> {
  const token = config.telegram.owner.token
  if (!token) return false

  // Parse `cs_<action>:<draft_id>` (some have a 3rd segment for the picker).
  const m = /^cs_([a-z_]+)(?::(.+))?$/.exec(data)
  if (!m) return false
  const action = m[1]
  const tail = m[2]
  const ctx: StudioCallContext = { token, chatId }

  switch (action) {
    case 'list':
      return openDraftsList(ctx)
    case 'plan':
      return openPlanWeek(ctx)
    case 'seed_week':
      planService.ensureWeek(isoWeekOf(Date.now()))
      return openPlanWeek(ctx)
    case 'open':
      return tail ? openDraft(tail, ctx) : false
    case 'approve':
      return tail ? actApprove(tail, ctx) : false
    case 'discard':
      return tail ? actDiscard(tail, ctx) : false
    case 'sched':
      return tail ? showSchedulePicker(tail, ctx) : false
    case 'sched_at': {
      if (!tail) return false
      const [draftId, when] = tail.split(':')
      if (!draftId || !when) return false
      return actSchedule(draftId, when, ctx)
    }
    case 'pub':
      return tail ? actPublish(tail, ctx) : false
    case 'edit':
      return tail ? showEditHint(tail, ctx) : false
    case 'regen':
      return tail ? actRegenerate(tail, ctx) : false
    case 'new': {
      const kind = (tail as DraftKind) ?? 'post'
      await sendTelegram(
        token,
        chatId,
        `Tell me what the ${kind} is about — e.g. "make a ${kind} about Friday's pistachio batch".`,
      )
      return true
    }
    case 'stats':
      await sendTelegram(token, chatId, 'Stats coming in Phase 3 — campaigns + analytics layer.')
      return true
    default:
      return false
  }
}

async function openDraftsList(ctx: StudioCallContext): Promise<boolean> {
  const drafts = draftService.list({
    status: ['draft', 'brand_pending', 'approved', 'scheduled', 'failed'],
    limit: 20,
  })
  const v = renderDraftsList(drafts)
  await sendTelegram(ctx.token, ctx.chatId, v.text, v.keyboard)
  return true
}

async function openPlanWeek(ctx: StudioCallContext): Promise<boolean> {
  const week = isoWeekOf(Date.now())
  const slots = planService.ensureWeek(week)
  const draftIds = slots.map((s) => s.draft_id).filter((x): x is string => Boolean(x))
  const drafts = new Map<string, ContentDraft>()
  for (const id of draftIds) {
    const d = draftService.get(id)
    if (d) drafts.set(id, d)
  }
  const v = renderPlanWeek(week, slots, drafts)
  await sendTelegram(ctx.token, ctx.chatId, v.text, v.keyboard)
  return true
}

async function openDraft(draftId: string, ctx: StudioCallContext): Promise<boolean> {
  const draft = draftService.get(draftId)
  if (!draft) {
    await sendTelegram(ctx.token, ctx.chatId, `Draft ${draftId} not found.`)
    return true
  }
  const card = renderDraftCard(draft)
  await sendTelegram(ctx.token, ctx.chatId, card.text, card.keyboard)
  return true
}

async function actApprove(draftId: string, ctx: StudioCallContext): Promise<boolean> {
  try {
    const next = draftService.approve(draftId)
    const card = renderDraftCard(next)
    await sendTelegram(ctx.token, ctx.chatId, `✓ approved\n\n${card.text}`, card.keyboard)
  } catch (err) {
    await sendTelegram(ctx.token, ctx.chatId, `couldn't approve: ${(err as Error).message}`)
  }
  return true
}

async function actDiscard(draftId: string, ctx: StudioCallContext): Promise<boolean> {
  draftService.discard(draftId)
  await sendTelegram(ctx.token, ctx.chatId, `🗑 discarded ${draftId}`)
  return true
}

async function showSchedulePicker(draftId: string, ctx: StudioCallContext): Promise<boolean> {
  const draft = draftService.get(draftId)
  if (!draft) return false
  const v = renderSchedulePicker(draft)
  await sendTelegram(ctx.token, ctx.chatId, v.text, v.keyboard)
  return true
}

async function actSchedule(draftId: string, when: string, ctx: StudioCallContext): Promise<boolean> {
  const ts = parseScheduleHint(when)
  if (!ts) {
    await sendTelegram(ctx.token, ctx.chatId, `couldn't parse "${when}"`)
    return true
  }
  try {
    const next = draftService.schedule({ draft_id: draftId, scheduled_for: ts })
    const card = renderDraftCard(next)
    await sendTelegram(
      ctx.token,
      ctx.chatId,
      `📅 scheduled for ${new Date(ts).toISOString().slice(0, 16).replace('T', ' ')}\n\n${card.text}`,
      card.keyboard,
    )
  } catch (err) {
    await sendTelegram(ctx.token, ctx.chatId, `couldn't schedule: ${(err as Error).message}`)
  }
  return true
}

async function actPublish(draftId: string, ctx: StudioCallContext): Promise<boolean> {
  await sendTelegram(ctx.token, ctx.chatId, '⏳ publishing via sandbox MCP…')
  const outcome = await draftService.publish(draftId)
  const card = renderDraftCard(outcome.draft)
  const head = outcome.ok
    ? `🚀 published${outcome.draft.publish_receipt?.remote_id ? ` · ${outcome.draft.publish_receipt.remote_id}` : ''}`
    : `❌ failed: ${outcome.error}`
  await sendTelegram(ctx.token, ctx.chatId, `${head}\n\n${card.text}`, card.keyboard)
  return true
}

async function showEditHint(draftId: string, ctx: StudioCallContext): Promise<boolean> {
  await sendTelegram(
    ctx.token,
    ctx.chatId,
    `Send the new caption as a single message:\n  edit ${draftId} <new caption>`,
  )
  return true
}

async function actRegenerate(draftId: string, ctx: StudioCallContext): Promise<boolean> {
  const draft = draftService.get(draftId)
  if (!draft) return false
  if (!draft.source_intent) {
    await sendTelegram(ctx.token, ctx.chatId, 'no original intent saved on this draft.')
    return true
  }
  await sendTelegram(ctx.token, ctx.chatId, '🔁 regenerating…')
  const result = await draftCaption({
    intent: draft.source_intent,
    kind: draft.kind,
    sku_hint: draft.sku_refs,
  })
  if (!result.ok) {
    await sendTelegram(ctx.token, ctx.chatId, `regen failed: ${result.error ?? 'unknown'}`)
    return true
  }
  const next = draftService.editCaption({ draft_id: draftId, caption: result.caption })
  const card = renderDraftCard(next)
  await sendTelegram(ctx.token, ctx.chatId, card.text, card.keyboard)
  return true
}

// ─── "edit <id> <caption>" free-text handler ────────────────────────────

const EDIT_RE = /^edit\s+(draft_\S+)\s+([\s\S]+)$/i

export interface EditMatch { draftId: string; caption: string }
export function matchEditCommand(text: string): EditMatch | null {
  const m = EDIT_RE.exec(text.trim())
  if (!m) return null
  return { draftId: m[1], caption: m[2].trim() }
}

export async function applyEdit(
  draftId: string,
  caption: string,
  ctx: StudioCallContext,
): Promise<boolean> {
  try {
    const next = draftService.editCaption({ draft_id: draftId, caption })
    const card = renderDraftCard(next)
    await sendTelegram(ctx.token, ctx.chatId, `✓ updated\n\n${card.text}`, card.keyboard)
  } catch (err) {
    await sendTelegram(ctx.token, ctx.chatId, `couldn't edit: ${(err as Error).message}`)
  }
  return true
}

// ─── Helpers ────────────────────────────────────────────────────────────

function extractSkuHint(intent: string): string[] {
  // Look for explicit cake names anywhere in the intent. The drafter prompt
  // tells the LLM to use these verbatim. Heuristic-only; safe to be empty.
  const out: string[] = []
  const names = ['Honey', 'Pistachio Roll', 'Pistachio', 'Cloud', 'Tiramisu', 'Chak-chak']
  const lowered = intent.toLowerCase()
  for (const n of names) {
    if (lowered.includes(n.toLowerCase())) out.push(n)
  }
  return out
}

function parseScheduleHint(hint: string): number | null {
  const now = new Date()
  if (hint === '1h') return now.getTime() + 60 * 60 * 1000
  if (hint === 'today_17') {
    const d = new Date(now)
    d.setHours(17, 0, 0, 0)
    if (d.getTime() < now.getTime()) d.setDate(d.getDate() + 1)
    return d.getTime()
  }
  if (hint === 'tomorrow_09') {
    const d = new Date(now)
    d.setDate(d.getDate() + 1)
    d.setHours(9, 0, 0, 0)
    return d.getTime()
  }
  if (hint === 'tomorrow_12') {
    const d = new Date(now)
    d.setDate(d.getDate() + 1)
    d.setHours(12, 0, 0, 0)
    return d.getTime()
  }
  if (hint === 'saturday_10') {
    const d = new Date(now)
    const offset = (6 - d.getDay() + 7) % 7 || 7  // next Saturday
    d.setDate(d.getDate() + offset)
    d.setHours(10, 0, 0, 0)
    return d.getTime()
  }
  return null
}

async function live(ctx: StudioCallContext, text: string): Promise<void> {
  if (ctx.thinkingMsgId) {
    await editTelegramMessage(ctx.token, ctx.chatId, ctx.thinkingMsgId, text)
  } else {
    await sendTelegram(ctx.token, ctx.chatId, text)
  }
}
