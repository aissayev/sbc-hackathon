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

// 1 → "1st", 2 → "2nd", 3 → "3rd", 4 → "4th", 11–13 → "11th/12th/13th".
// Used for the repeat-customer badge: "🔁 7th order · $189.00 lifetime".
export function ordinal(n: number): string {
  if (n <= 0) return `${n}th`
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`
  switch (n % 10) {
    case 1: return `${n}st`
    case 2: return `${n}nd`
    case 3: return `${n}rd`
    default: return `${n}th`
  }
}
