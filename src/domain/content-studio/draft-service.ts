// Draft service — application-layer use cases.
//
// Depends on the ContentRepository interface (DI), the brand-checker (pure
// fn), and a PublishAdapter resolver (factory). Has zero knowledge of TG,
// HTTP, or claude -p — those are orchestrated by the caller.

import type { ContentRepository } from './repository.ts'
import {
  newDraftId,
  type ContentDraft,
  type DraftKind,
  type DraftChannel,
  type DraftStatus,
  type ReelBrief,
} from './entities.ts'
import { checkBrand } from './brand-checker.ts'
import type { ChannelKey, PublishAdapter } from '../../agent/mcp/adapters/index.ts'
import { getAdapter } from '../../agent/mcp/adapters/index.ts'

export interface CreateDraftInput {
  kind: DraftKind
  channel: DraftChannel
  caption: string
  brief?: ReelBrief
  media_urls?: string[]
  sku_refs?: string[]
  source_intent?: string
  slot_id?: string | null
}

export interface EditCaptionInput {
  draft_id: string
  caption: string
  owner_note?: string | null
}

export interface ScheduleInput {
  draft_id: string
  scheduled_for: number  // epoch ms
}

export interface PublishOutcome {
  ok: boolean
  draft: ContentDraft
  error?: string
}

export class DraftService {
  constructor(
    private readonly repo: ContentRepository,
    private readonly resolveAdapter: (channel: ChannelKey) => PublishAdapter = getAdapter,
  ) {}

  // ─── Create / edit ─────────────────────────────────────────────────

  create(input: CreateDraftInput): ContentDraft {
    const now = Date.now()
    const check = checkBrand({ caption: input.caption, kind: input.kind })
    const draft: ContentDraft = {
      id: newDraftId(),
      kind: input.kind,
      channel: input.channel,
      status: check.ok ? 'draft' : 'brand_pending',
      caption: input.caption,
      brief: input.brief ?? null,
      media_urls: input.media_urls ?? [],
      sku_refs: input.sku_refs ?? [],
      brand_check: check,
      owner_note: null,
      scheduled_for: null,
      publish_receipt: null,
      tg_card_msg_id: null,
      source_intent: input.source_intent ?? null,
      slot_id: input.slot_id ?? null,
      created_at: now,
      updated_at: now,
    }
    this.repo.saveDraft(draft)
    return draft
  }

  editCaption({ draft_id, caption, owner_note }: EditCaptionInput): ContentDraft {
    const existing = this.mustGet(draft_id)
    const check = checkBrand({ caption, kind: existing.kind })
    const next: ContentDraft = {
      ...existing,
      caption,
      brand_check: check,
      // Editing kicks status back to draft if it was approved.
      status: this.statusAfterEdit(existing.status, check.ok),
      owner_note: owner_note === undefined ? existing.owner_note : owner_note,
      updated_at: Date.now(),
    }
    this.repo.saveDraft(next)
    return next
  }

  private statusAfterEdit(prev: DraftStatus, brandOk: boolean): DraftStatus {
    if (prev === 'published' || prev === 'publishing') return prev
    if (!brandOk) return 'brand_pending'
    if (prev === 'approved' || prev === 'scheduled') return 'draft'
    return prev
  }

  attachTgCardId(draft_id: string, tg_card_msg_id: number): void {
    const existing = this.mustGet(draft_id)
    this.repo.saveDraft({ ...existing, tg_card_msg_id, updated_at: Date.now() })
  }

  // ─── Lifecycle transitions ────────────────────────────────────────

  approve(draft_id: string): ContentDraft {
    const existing = this.mustGet(draft_id)
    if (existing.brand_check && !existing.brand_check.ok) {
      throw new Error('cannot approve: brand check has blockers')
    }
    const next: ContentDraft = { ...existing, status: 'approved', updated_at: Date.now() }
    this.repo.saveDraft(next)
    return next
  }

  schedule({ draft_id, scheduled_for }: ScheduleInput): ContentDraft {
    const existing = this.mustGet(draft_id)
    if (existing.brand_check && !existing.brand_check.ok) {
      throw new Error('cannot schedule: brand check has blockers')
    }
    const next: ContentDraft = {
      ...existing,
      status: 'scheduled',
      scheduled_for,
      updated_at: Date.now(),
    }
    this.repo.saveDraft(next)
    return next
  }

  discard(draft_id: string): ContentDraft {
    const existing = this.mustGet(draft_id)
    const next: ContentDraft = { ...existing, status: 'discarded', updated_at: Date.now() }
    this.repo.saveDraft(next)
    return next
  }

  // ─── Publish ──────────────────────────────────────────────────────
  // Publish is the only method that talks to the outside world. It uses
  // the adapter registry — sandbox MCP today, real Meta/GBP tomorrow.

  async publish(draft_id: string): Promise<PublishOutcome> {
    const existing = this.mustGet(draft_id)
    if (existing.brand_check && !existing.brand_check.ok) {
      return { ok: false, draft: existing, error: 'brand check has blockers' }
    }

    // Mark publishing first (idempotency guard for the scheduler tick).
    const inflight: ContentDraft = { ...existing, status: 'publishing', updated_at: Date.now() }
    this.repo.saveDraft(inflight)

    const channelKey = mapChannelToAdapter(existing.channel)
    if (!channelKey) {
      const failed: ContentDraft = {
        ...inflight,
        status: 'failed',
        publish_receipt: {
          tool: 'none',
          tool_input: existing.channel,
          tool_output: 'unsupported channel for content-studio publish',
          ts: Date.now(),
        },
        updated_at: Date.now(),
      }
      this.repo.saveDraft(failed)
      return { ok: false, draft: failed, error: 'unsupported channel' }
    }

    const adapter = this.resolveAdapter(channelKey)
    let receipt
    let outcomeOk = false
    let err: string | undefined
    try {
      let result
      if (existing.kind === 'reel' && adapter.reel) {
        result = await adapter.reel({
          caption: existing.caption,
          video_url: existing.media_urls[0],
          hook: existing.brief?.hook,
          voiceover: existing.brief?.voiceover,
        })
      } else {
        // PostInput.channel narrows to ig/fb/gbp/multi. wa has no post surface
        // so it short-circuits to broadcast above; here we just down-cast.
        const postChannel: 'ig' | 'fb' | 'gbp' | 'multi' =
          existing.channel === 'multi' ? 'multi' :
          channelKey === 'wa' ? 'ig' : channelKey
        result = await adapter.post({
          caption: existing.caption,
          media_urls: existing.media_urls,
          channel: postChannel,
        })
      }
      outcomeOk = result.ok
      err = result.error
      receipt = {
        tool: adapter.name,
        tool_input: { kind: existing.kind, channel: existing.channel },
        tool_output: result.raw ?? result,
        remote_id: result.remote_id,
        url: result.url,
        ts: Date.now(),
      }
    } catch (e) {
      err = (e as Error).message
      receipt = {
        tool: adapter.name,
        tool_input: { kind: existing.kind, channel: existing.channel },
        tool_output: { error: err },
        ts: Date.now(),
      }
    }

    const finalStatus: DraftStatus = outcomeOk ? 'published' : 'failed'
    const final: ContentDraft = {
      ...inflight,
      status: finalStatus,
      publish_receipt: receipt,
      updated_at: Date.now(),
    }
    this.repo.saveDraft(final)
    return { ok: outcomeOk, draft: final, error: err }
  }

  // ─── Queries ──────────────────────────────────────────────────────

  list(filter: Parameters<ContentRepository['listDrafts']>[0]): ContentDraft[] {
    return this.repo.listDrafts(filter)
  }

  get(id: string): ContentDraft | null {
    return this.repo.getDraft(id)
  }

  private mustGet(id: string): ContentDraft {
    const d = this.repo.getDraft(id)
    if (!d) throw new Error(`draft not found: ${id}`)
    return d
  }
}

function mapChannelToAdapter(channel: DraftChannel): ChannelKey | null {
  if (channel === 'ig' || channel === 'fb' || channel === 'gbp' || channel === 'wa') return channel
  // 'multi' fans out — for Phase 1 we route multi through ig as the primary.
  if (channel === 'multi') return 'ig'
  return null
}
