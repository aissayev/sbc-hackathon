// Content scheduler — fires every N minutes, publishes any draft whose
// `scheduled_for` has passed, and ages out stale drafts.
//
// Same single-timer pattern as src/domain/catalog-sync.ts so boot costs and
// shutdown semantics line up. Idempotent: each draft transitions through
// `scheduled → publishing → published|failed`, so a duplicate tick is safe.
//
// Aligns with the rest of the system:
//   - Reads/writes via SqliteContentRepository (same DB handle).
//   - Publishes via the adapter registry (sandbox MCP today).
//   - Posts a notification to the owner via the existing logSystem channel
//     so the operator sees "🚀 published <id>" in the same TG feed.

import { SqliteContentRepository, DraftService } from './index.ts'
import type { ContentDraft } from './index.ts'
import { sendTelegram } from '../../channels/telegram.ts'
import { config } from '../../config.ts'
import { renderDraftCard } from '../../bots/owner/marketing/presenter.ts'
import { shortId } from '../../bots/owner/format.ts'

const HOUR_MS = 3600_000

let timer: ReturnType<typeof setInterval> | null = null
let runningTick = false

interface Deps {
  intervalMs: number
  repo?: SqliteContentRepository
  service?: DraftService
}

export function startContentScheduler(opts: Deps): void {
  if (timer !== null) return
  const repo = opts.repo ?? new SqliteContentRepository()
  const service = opts.service ?? new DraftService(repo)

  // Fire once non-blocking so freshly-due drafts publish on boot.
  void tick(repo, service).then((n) => {
    if (n > 0) console.log(`[content-scheduler] boot: published ${n}`)
  })

  timer = setInterval(() => {
    void tick(repo, service)
  }, opts.intervalMs)
  if (typeof timer.unref === 'function') timer.unref()
}

export function stopContentScheduler(): void {
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
}

/** Single tick. Returns the number of drafts that transitioned this round. */
export async function tick(
  repo: SqliteContentRepository,
  service: DraftService,
): Promise<number> {
  if (runningTick) return 0    // overlapping ticks would re-publish.
  runningTick = true
  try {
    const now = Date.now()
    const due = repo.listScheduledDue({ upTo: now, limit: 10 })
    let published = 0
    for (const draft of due) {
      const outcome = await service.publish(draft.id)
      if (outcome.ok) {
        published += 1
        await notifyOwner(outcome.draft, true)
      } else {
        await notifyOwner(outcome.draft, false, outcome.error)
      }
    }
    expireStaleDrafts(repo, now)
    return published
  } finally {
    runningTick = false
  }
}

function expireStaleDrafts(repo: SqliteContentRepository, now: number): void {
  // Drafts in `draft` / `brand_pending` that haven't been touched in 72h
  // get expired. Drafts in `approved` after 24h get an owner ping (Phase 2
  // adds the actual ping; for Phase 1 we just expire after 72h).
  const stale = repo.listDrafts({
    status: ['draft', 'brand_pending'],
    limit: 50,
  })
  for (const d of stale) {
    if (now - d.updated_at > 72 * HOUR_MS) {
      repo.saveDraft({ ...d, status: 'expired', updated_at: now })
    }
  }
}

async function notifyOwner(draft: ContentDraft, ok: boolean, err?: string): Promise<void> {
  const token = config.telegram.owner.token
  const chatId = config.telegram.owner.chatId
  if (!token || !chatId) return
  const card = renderDraftCard(draft)
  const head = ok
    ? `🚀 auto-published ${shortId(draft.id)}`
    : `❌ scheduler couldn't publish ${shortId(draft.id)}: ${err ?? 'unknown'}`
  try {
    await sendTelegram(token, chatId, `${head}\n\n${card.text}`, card.keyboard)
  } catch {
    // best-effort; the receipt is on the draft already
  }
}
