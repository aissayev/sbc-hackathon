// Heuristic sentiment scorer. Cheap, deterministic, no LLM call.
//
// Why heuristic + not LLM-judged: every inbox tick scores N items. Burning
// `claude -p` per item is wasteful when 90% of comments are obviously
// positive ("looks unreal!") or obviously negative ("burnt my tongue").
// The bot escalates ambiguous cases instead of guessing.
//
// Output is a triplet (positive/neutral/negative) plus a `risk` flag for
// the cases that should NEVER auto-reply: complaints, allergen scares,
// public threats. Phase 4 promotes risk → owner-ping.

export type SentimentLabel = 'positive' | 'neutral' | 'negative' | 'risk'

export interface SentimentScore {
  label: SentimentLabel
  score: number      // -1.0 to 1.0
  reasons: string[]  // matched signals (audit trail)
  risk: boolean      // never auto-reply when true
}

const POSITIVE = [
  'love', 'amazing', 'unreal', 'best', 'delicious', 'perfect', 'awesome',
  'fantastic', 'beautiful', 'gorgeous', 'incredible', 'thank', 'recommend',
  'fresh', 'tasty', 'soft', 'fluffy', 'moist', 'authentic', 'genuine',
]

const NEGATIVE = [
  'bad', 'awful', 'terrible', 'worst', 'never', 'overcooked', 'undercooked',
  'stale', 'soggy', 'late', 'rude', 'cold', 'dry', 'mistake', 'wrong',
  'disappointed', 'horrible', 'rip-off', 'overpriced', 'mediocre', 'bland',
]

// Risk patterns use proper regex with word boundaries to avoid false positives
// like "after eating here" matching "er ". Multi-word phrases are anchored
// with \b on the first word.
const RISK_PATTERNS: Array<RegExp> = [
  /\bsick\b/, /\bfood poisoning\b/, /\ballergic reaction\b/, /\bhospital\b/,
  /\bemergency room\b/, /\bER visit\b/i, /\bdangerous\b/,
  /\blawyer\b/, /\bsue\b/, /\bunsafe\b/, /\bcockroach\b/, /\bhair in\b/,
  /\bbug in\b/, /\bexpired\b/, /\bspoiled\b/, /\brotten\b/, /\bsalmonella\b/,
  /\bglass in\b/, /\bmetal in\b/, /\bchoking\b/,
  /\bburnt my\b/, /\btongue burn\b/,
]

const NEGATION = /\b(?:not|no|never|isn't|wasn't|wouldn't)\b/i

export function scoreSentiment(text: string): SentimentScore {
  if (!text || text.trim().length === 0) {
    return { label: 'neutral', score: 0, reasons: [], risk: false }
  }
  const normalized = text.toLowerCase()
  const reasons: string[] = []

  // Risk gates first — any of these and we never auto-reply.
  for (const pattern of RISK_PATTERNS) {
    const m = pattern.exec(normalized)
    if (m) reasons.push(`risk:${m[0].trim()}`)
  }
  if (reasons.length > 0) {
    return { label: 'risk', score: -1, reasons, risk: true }
  }

  let pos = 0
  let neg = 0
  const words = normalized.match(/[a-z']+/g) ?? []
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    const prevWindow = words.slice(Math.max(0, i - 3), i).join(' ')
    const negated = NEGATION.test(prevWindow)
    if (POSITIVE.includes(w)) {
      if (negated) {
        neg += 1
        reasons.push(`pos-but-negated:${w}`)
      } else {
        pos += 1
        reasons.push(`pos:${w}`)
      }
    }
    if (NEGATIVE.includes(w)) {
      if (negated) {
        pos += 1
        reasons.push(`neg-but-negated:${w}`)
      } else {
        neg += 1
        reasons.push(`neg:${w}`)
      }
    }
  }

  const total = pos + neg
  if (total === 0) return { label: 'neutral', score: 0, reasons: [], risk: false }
  const score = (pos - neg) / total
  let label: SentimentLabel = 'neutral'
  if (score > 0.4) label = 'positive'
  else if (score < -0.2) label = 'negative'
  return { label, score, reasons, risk: false }
}

export function sentimentGlyph(label: SentimentLabel): string {
  switch (label) {
    case 'positive': return '💚'
    case 'negative': return '⚠️'
    case 'risk': return '🚨'
    default: return '◼️'
  }
}
