// Owner-bot formatting helpers.
//
// Plain-text only — no Markdown/HTML — because src/channels/telegram.ts:sendTelegram
// currently doesn't pass a parse_mode (and that file is in active flux on a
// parallel branch; modifying its signature risks merge conflicts).
// If/when sendTelegram learns parse_mode, swap to HTML for bold/code styling.

export const fmtMoney = (cents: number): string => `$${(cents / 100).toFixed(2)}`

export const shortId = (id: string): string =>
  id.length > 16 ? id.slice(0, 16) + '…' : id

export const hhmm = (ts: number): string =>
  new Date(ts).toISOString().slice(11, 16)

// 1-5 → '★★★★☆' (star rating glyphs for review listings).
// Clamps to [0,5] and rounds to int. Plain text — no parse_mode needed.
export const stars = (n: number): string => {
  const clamped = Math.max(0, Math.min(5, Math.round(n)))
  return '★'.repeat(clamped) + '☆'.repeat(5 - clamped)
}

// Truncate to maxLen, appending an ellipsis if it had to cut. Used in list
// rows so a long thread/post doesn't blow out a TG message line.
export const truncate = (s: string, maxLen: number): string => {
  if (typeof s !== 'string') return ''
  if (s.length <= maxLen) return s
  return s.slice(0, Math.max(0, maxLen - 1)) + '…'
}
