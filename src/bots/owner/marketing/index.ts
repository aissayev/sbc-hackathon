// Owner-side marketing TG cockpit — public surface.
//
// Phase 1: post-studio (free-text → drafted caption → approve/schedule/publish)
//          + content-plan calendar.
// Phase 2: engagement (comments + reviews inbox).
// Phase 3: campaigns + budget + analytics.
// Phase 4: reels studio + WA broadcast + proactive nudges.

export {
  draftService,
  planService,
  matchPostIntent,
  matchEditCommand,
  startDraft,
  applyEdit,
  handleStudioCallback,
  type PostIntent,
  type EditMatch,
  type StudioCallContext,
} from './post-studio.ts'

export {
  renderDraftCard,
  renderPlanWeek,
  renderDraftsList,
  renderSchedulePicker,
  renderBrandCheck,
} from './presenter.ts'

import { isoWeekOf } from '../../../domain/content-studio/index.ts'
import { draftService, planService } from './post-studio.ts'
import { renderPlanWeek, renderDraftsList } from './presenter.ts'
import type { ContentDraft } from '../../../domain/content-studio/index.ts'

export interface BotReply {
  text: string
  keyboard?: Array<Array<{ text: string; data: string }>>
}

/** /content — calendar view for the current week. Idempotent: seeds the
 *  default rhythm if the week is empty. */
export function handleContentCommand(): BotReply {
  const week = isoWeekOf(Date.now())
  const slots = planService.ensureWeek(week)
  const drafts = new Map<string, ContentDraft>()
  for (const slot of slots) {
    if (slot.draft_id) {
      const d = draftService.get(slot.draft_id)
      if (d) drafts.set(slot.draft_id, d)
    }
  }
  const v = renderPlanWeek(week, slots, drafts)
  return { text: v.text, keyboard: v.keyboard }
}

/** /drafts — list of in-flight drafts. */
export function handleDraftsCommand(): BotReply {
  const drafts = draftService.list({
    status: ['draft', 'brand_pending', 'approved', 'scheduled', 'failed'],
    limit: 20,
  })
  const v = renderDraftsList(drafts)
  return { text: v.text, keyboard: v.keyboard }
}
