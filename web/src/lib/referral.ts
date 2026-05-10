// Referral attribution. A `?ref=<token>` on any inbound URL gets stashed in
// sessionStorage so it survives the customer navigating from the landing
// page (where the campaign URL drops them) into the order/funnel pages.
//
// Tokens are short campaign slugs we control: `ig`, `gbp`, `email-2026-05`,
// partner codes, etc. Capped at 64 chars and lowercased to match what the
// backend stores.
//
// First-touch wins: once a ref is captured for a session, later URLs without
// `?ref=` don't clear it, but a different `?ref=` overwrites (multi-touch
// last-click within a session, which matches how most attribution works).

const KEY = 'hc_ref'
const MAX_LEN = 64

function normalize(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase().slice(0, MAX_LEN)
  // Defend against XSS by allowing only safe slug chars. If anything else
  // sneaks in (e.g. user pasted a URL into ?ref=), drop the whole token.
  if (!/^[a-z0-9._-]+$/.test(trimmed)) return null
  return trimmed
}

/** Pull `?ref=` from the current URL into sessionStorage. Idempotent + safe to
 *  call on every mount. No-op on the server (SSR).
 */
export function captureReferral(): void {
  if (typeof window === 'undefined') return
  try {
    const sp = new URLSearchParams(window.location.search)
    const raw = sp.get('ref')
    if (!raw) return
    const clean = normalize(raw)
    if (!clean) return
    window.sessionStorage.setItem(KEY, clean)
  } catch {
    // Storage may be disabled (Safari private mode) — silent fallback to no ref.
  }
}

/** Read the captured referral token, or null if none. Always SSR-safe. */
export function getReferral(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}
