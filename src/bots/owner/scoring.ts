// Lead scoring for draft order cards.
//
// Score 1-5 stars based on three deterministic factors:
//   - Order value (cents):  large = high signal
//   - Repeat customer:      thread history shows past completed order
//   - Channel margin hint:  some channels are more committed (e.g. web > IG comment)
//
// Pure function; no side effects. Pulled in by postDraftOrderCard so the
// owner sees ★★★☆☆ on the approval card and can prioritise.

import { getDb } from '../../db/db.ts'

interface ScoringInput {
  total_cents: number
  thread_id: string
  channel?: string | null
}

export interface LeadScore {
  stars: number          // 1..5
  reasons: string[]      // short bullet phrases for the card
}

export function scoreLead(input: ScoringInput): LeadScore {
  let raw = 1
  const reasons: string[] = []

  // Order-value tiers (cents)
  if (input.total_cents >= 10000) {
    raw += 2
    reasons.push(`$${(input.total_cents / 100).toFixed(0)} order`)
  } else if (input.total_cents >= 5000) {
    raw += 1
    reasons.push(`$${(input.total_cents / 100).toFixed(0)} order`)
  }

  // Repeat customer signal — same thread has prior completed order?
  try {
    const prior = getDb()
      .prepare(
        `SELECT COUNT(*) as n FROM orders WHERE thread_id = ? AND status IN ('completed','approved')`,
      )
      .get(input.thread_id) as { n: number } | undefined
    if (prior && prior.n > 0) {
      raw += 1
      reasons.push(`returning customer (${prior.n} prior)`)
    }
  } catch {
    // ignore — fresh DB or schema drift; just don't bonus
  }

  // Channel commitment hint
  const ch = input.channel ?? 'web'
  if (ch === 'web') {
    raw += 1
    reasons.push('web channel')
  } else if (ch === 'whatsapp') {
    raw += 1
    reasons.push('WA channel')
  }

  // Clamp to 1-5
  const stars = Math.max(1, Math.min(5, raw))
  return { stars, reasons }
}

export function fmtStars(stars: number): string {
  const filled = Math.max(0, Math.min(5, Math.round(stars)))
  return '\u2605'.repeat(filled) + '\u2606'.repeat(5 - filled)
}
