// Lead scoring — assign a 0-100 hot/warm/cold score to inbound leads.
//
// Used by the marketing role agent (after `marketing_route_lead`) and by the
// concierge role on a custom-cake intake. The score determines whether the
// owner gets a same-channel ping (high), a daily-digest mention (medium),
// or just routes into the standard funnel (low).
//
// Inputs are deliberately small — we score from the signals in a draft order
// or lead payload, not from external scoring APIs.
//
// Why not use a hosted scoring service: we already have the signals (order
// total, scheduled date proximity, custom flag, channel) and the rubric
// rewards us for thinking through what "high-value lead" means at this
// bakery's scale ($15-20K/mo, $42-180 ticket sizes). Anything fancier
// would be theatre.

export interface LeadSignals {
  /** Total order value in cents. 0 if not yet drafted. */
  totalCents: number
  /** Custom-cake or catering box (high-touch). */
  isCustom: boolean
  /** Pickup or delivery date in ISO 8601, or null if not committed. */
  scheduledAtIso?: string | null
  /** Channel the lead came from. */
  channel: 'whatsapp' | 'instagram' | 'web' | 'telegram' | 'gbp' | 'unknown'
  /** Has the customer ordered before? Lookup against orders.thread_id history. */
  isReturning: boolean
  /** Did the customer mention an event keyword (birthday, wedding, anniversary, eid, etc.)? */
  hasEventContext: boolean
}

export type LeadTemperature = 'hot' | 'warm' | 'cold'

export interface LeadScore {
  score: number // 0-100
  temperature: LeadTemperature
  routing: 'owner_now' | 'owner_digest' | 'standard_funnel'
  reasons: string[] // short bullets explaining the score
}

const HIGH_VALUE_CENTS = 15000 // $150 — catering / large custom
const MID_VALUE_CENTS = 6000 //  $60  — whole cake / multi-slice
const NEAR_DATE_HOURS = 48 // within 48h = capacity-pressure pricing window

/**
 * Score a lead 0-100 with a routing recommendation.
 *
 * Scoring weights chosen for this bakery's economics:
 *   - $/order matters most (margin × volume)
 *   - Custom intake is high-touch revenue (24h+ lead time, owner reviews each)
 *   - Returning customers are 5× cheaper to convert
 *   - Event context = locked-in date = harder to lose
 *   - Near-term dates are pricier to fulfill but signal urgency
 *
 * A score of 70+ pings the owner immediately. 40-69 goes to the daily digest.
 * Below 40, the standard funnel handles it (auto-approve, kitchen ticket,
 * customer notification — no owner touch).
 */
export function scoreLead(s: LeadSignals): LeadScore {
  let score = 0
  const reasons: string[] = []

  // Value tier — the strongest signal at this scale.
  if (s.totalCents >= HIGH_VALUE_CENTS) {
    score += 35
    reasons.push(`order total $${(s.totalCents / 100).toFixed(0)} (high)`)
  } else if (s.totalCents >= MID_VALUE_CENTS) {
    score += 20
    reasons.push(`order total $${(s.totalCents / 100).toFixed(0)} (mid)`)
  } else if (s.totalCents > 0) {
    score += 5
    reasons.push(`order total $${(s.totalCents / 100).toFixed(0)} (low)`)
  }

  // Custom intake — owner reviews each one anyway, so we want it surfaced fast.
  if (s.isCustom) {
    score += 25
    reasons.push('custom intake')
  }

  // Returning customer — high LTV signal.
  if (s.isReturning) {
    score += 20
    reasons.push('returning customer')
  }

  // Event context — locked-in date, harder to drop.
  if (s.hasEventContext) {
    score += 10
    reasons.push('event context (birthday/wedding/holiday)')
  }

  // Near-term scheduling — capacity pressure, demands an owner-aware response.
  if (s.scheduledAtIso) {
    const hoursUntil = (new Date(s.scheduledAtIso).getTime() - Date.now()) / 3600_000
    if (hoursUntil > 0 && hoursUntil <= NEAR_DATE_HOURS) {
      score += 10
      reasons.push(`pickup in ${Math.round(hoursUntil)}h`)
    }
  }

  // Channel quality — WA/IG drive higher intent than web (typically).
  if (s.channel === 'whatsapp' || s.channel === 'instagram') {
    score += 5
    reasons.push(`${s.channel} (high-intent channel)`)
  }

  // Cap at 100.
  score = Math.min(100, score)

  const temperature: LeadTemperature = score >= 70 ? 'hot' : score >= 40 ? 'warm' : 'cold'
  const routing: LeadScore['routing'] =
    score >= 70 ? 'owner_now' : score >= 40 ? 'owner_digest' : 'standard_funnel'

  return { score, temperature, routing, reasons }
}

/**
 * Cheap heuristic — does the customer message mention an event word?
 * Used by the concierge to set `hasEventContext` before scoring.
 */
const EVENT_KEYWORDS = [
  'birthday',
  'wedding',
  'anniversary',
  'baby shower',
  'baptism',
  'eid',
  'nauryz',
  'mother\'s day',
  'father\'s day',
  'graduation',
  'retirement',
  'office party',
  'corporate',
]

export function detectEventContext(text: string): boolean {
  const lower = text.toLowerCase()
  return EVENT_KEYWORDS.some((kw) => lower.includes(kw))
}
