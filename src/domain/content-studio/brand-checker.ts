// Deterministic brand-book validator. Run on every draft AFTER LLM
// generation, BEFORE owner approval, AND BEFORE publish.
//
// The LLM gets the brand voice via prompt-prepend (src/agent/prompts/brand.md)
// — but that's a "soft" gate. This file is the "hard" gate: regex-level
// blockers for the four rules the brand book frames as non-negotiable, plus
// warnings for the soft rules (length, emoji density, CTA presence).
//
// Why deterministic and not LLM-judged:
//  - cheap (no `claude -p` spend per draft)
//  - reproducible (same input → same output, scores stable in eval)
//  - auditable (the issue codes are the rubric line items)
//
// Source of truth: docs/00-source/BRANDBOOK.md (615 lines). Keep this file
// in sync if the brand book gets edits — the prompt summary at
// src/agent/prompts/brand.md is the place that tracks long-form changes.

import type { BrandCheck, BrandIssue, DraftKind } from './entities.ts'

const WORDMARK_OK = /\bHappyCake\b/
const WORDMARK_BAD = /\bHappy\s+Cake\b/g

// "Honey cake", "honey-cake", "Pistachio cake" — the brand book mandates
// `cake "Honey"` / `cake "Pistachio Roll"` quoted form. We allow the
// quoted form anywhere; fail only the unquoted variants.
const CAKE_NAMES = ['Honey', 'Pistachio Roll', 'Cloud', 'Tiramisu']
function unquotedCakeNamePattern(name: string): RegExp {
  // Match "Honey cake", "honey cake", but NOT cake "Honey" or generic
  // "honey" (e.g. "honey-bound dough").
  const escaped = name.replace(/[\s.]/g, '\\s+')
  return new RegExp(`\\b${escaped}\\s+cake\\b`, 'i')
}

const BANNED_PHRASES = [
  { phrase: /\bthe team\b/i, fix: 'Use "Askhat" by name when escalating' },
  { phrase: /\bbest in town\b/i, fix: 'Drop superlatives — let the cake speak' },
  { phrase: /\bpremium dessert\b/i, fix: 'We don\'t do "luxury" — homemade voice' },
  { phrase: /\bluxury\b/i, fix: 'Brand book: "We don\'t perform luxury"' },
]

const SOFT_CTAS = [
  /happycake\.us/i,
  /whatsapp/i,
  /\bdm\b|direct\s*message/i,
  /(text|message)\s+us/i,
]

// Emoji detector — Unicode ranges + variation selectors. Counts unique
// emoji glyphs, not codepoints (so 👨‍🍳 with ZWJ counts as one).
const EMOJI_RE = /\p{Extended_Pictographic}(?:‍\p{Extended_Pictographic})*/gu

// Cyrillic + Greek + Arabic + CJK ranges — anything non-Latin where the
// brand book wants English-only output. Punctuation passes through.
const NON_LATIN_RE = /[Ѐ-ӿͰ-Ͽ؀-ۿ一-鿿]/

const LENGTH_LIMITS: Record<DraftKind, number> = {
  post: 2200,
  reel: 2200,
  story: 500,
  gbp_post: 1500,
  comment_reply: 500,
  review_reply: 1000,
  wa_broadcast: 1024,
}

export interface CheckInput {
  caption: string
  kind: DraftKind
}

export function checkBrand({ caption, kind }: CheckInput): BrandCheck {
  const issues: BrandIssue[] = []
  const text = caption.trim()

  // ── Blockers ────────────────────────────────────────────────────────
  const badWordmark = text.match(WORDMARK_BAD)
  if (badWordmark && badWordmark.length > 0) {
    issues.push({
      severity: 'block',
      code: 'wordmark_two_words',
      msg: `Wrote "${badWordmark[0]}" — must be one word: HappyCake`,
      fix: 'Replace "Happy Cake" with "HappyCake"',
    })
  }

  for (const name of CAKE_NAMES) {
    if (unquotedCakeNamePattern(name).test(text)) {
      issues.push({
        severity: 'block',
        code: 'cake_name_unquoted',
        msg: `"${name} cake" should be cake "${name}"`,
        fix: `Use cake "${name}" with quotes`,
      })
    }
  }

  for (const banned of BANNED_PHRASES) {
    if (banned.phrase.test(text)) {
      issues.push({
        severity: 'block',
        code: 'banned_phrase',
        msg: `Banned phrase: ${String(banned.phrase).replace(/\\b|\//g, '').replace(/i$/, '')}`,
        fix: banned.fix,
      })
    }
  }

  // ── Warnings ────────────────────────────────────────────────────────
  if (!WORDMARK_OK.test(text) && kind !== 'comment_reply' && kind !== 'review_reply') {
    issues.push({
      severity: 'warn',
      code: 'wordmark_missing',
      msg: 'No "HappyCake" wordmark in caption',
      fix: 'Mention HappyCake at least once for brand recall',
    })
  }

  const emojis = text.match(EMOJI_RE) ?? []
  if (emojis.length > 3) {
    issues.push({
      severity: 'block',
      code: 'emoji_overload',
      msg: `${emojis.length} emoji — brand cap is 3`,
      fix: `Trim ${emojis.length - 3} emoji`,
    })
  } else if (emojis.length === 3) {
    issues.push({
      severity: 'warn',
      code: 'emoji_at_cap',
      msg: '3 emoji — at the brand cap (max)',
    })
  }

  if (NON_LATIN_RE.test(text)) {
    issues.push({
      severity: 'warn',
      code: 'non_english',
      msg: 'Non-Latin characters detected — brand voice is English-only',
    })
  }

  if (text.length > LENGTH_LIMITS[kind]) {
    issues.push({
      severity: 'warn',
      code: 'too_long',
      msg: `${text.length} chars — ${kind} limit is ${LENGTH_LIMITS[kind]}`,
    })
  } else if (text.length < 40 && kind !== 'comment_reply') {
    issues.push({
      severity: 'warn',
      code: 'too_short',
      msg: `${text.length} chars — captions under 40 feel thin`,
    })
  }

  // CTA only required for outbound posts/reels/GBP — not for replies/broadcast
  // (broadcast is itself the CTA). Soft warning, never block.
  if (kind === 'post' || kind === 'reel' || kind === 'gbp_post') {
    const hasCta = SOFT_CTAS.some((re) => re.test(text))
    if (!hasCta) {
      issues.push({
        severity: 'warn',
        code: 'cta_missing',
        msg: 'No soft CTA — brand book closes most posts with happycake.us or WhatsApp',
        fix: 'Add: "Order on the site at happycake.us or send a message on WhatsApp."',
      })
    }
  }

  // ── Score ──────────────────────────────────────────────────────────
  const blockers = issues.filter((i) => i.severity === 'block').length
  const warnings = issues.filter((i) => i.severity === 'warn').length
  const score = Math.max(0, 100 - blockers * 30 - warnings * 8)

  return {
    ok: blockers === 0,
    score,
    issues,
    checked_at: Date.now(),
  }
}

export function summarizeCheck(check: BrandCheck): string {
  if (check.issues.length === 0) return '✓ brand check passed'
  const blockers = check.issues.filter((i) => i.severity === 'block')
  const warnings = check.issues.filter((i) => i.severity === 'warn')
  const parts: string[] = []
  if (blockers.length > 0) parts.push(`✗ ${blockers.length} blocker${blockers.length === 1 ? '' : 's'}`)
  if (warnings.length > 0) parts.push(`⚠ ${warnings.length} warning${warnings.length === 1 ? '' : 's'}`)
  return parts.join(' · ')
}
