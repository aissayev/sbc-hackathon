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
