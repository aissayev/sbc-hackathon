// Single HTTP client to graph.instagram.com.
//
// All outbound calls (text, sender actions, comment reply) flow
// through `igGraphPost`. It handles:
//   - auth (token from config)
//   - one retry with 500ms backoff on 5xx / 429 / network throws
//   - structured logging on failure (status + first 200 bytes of body)
//   - early bail when the channel isn't configured (returns ok=false
//     so callers can keep going on the sandbox path without a throw)
//
// The IG-direct DM API uses graph.instagram.com; the comment-reply API
// uses graph.facebook.com (Page-level). Both go through this client
// with different `host` values.

import { config } from '../../config.ts'

export const IG_DIRECT_HOST = 'https://graph.instagram.com/v25.0'
export const IG_GRAPH_HOST = 'https://graph.facebook.com/v25.0'

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504])

export interface IgPostResult {
  ok: boolean
  status?: number
  // Best-effort error message for logs / cockpit feedback.
  error?: string
  // The decoded response body if it was JSON, for callers that need it
  // (e.g. message_id from a successful send).
  data?: unknown
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * POST to a graph endpoint. Returns a discriminated result; never throws.
 *
 * @param host        Either IG_DIRECT_HOST or IG_GRAPH_HOST.
 * @param path        Path AFTER the version, e.g. '/me/messages'.
 * @param body        JSON body.
 * @param opts.label  Logged on failure so multiple call-sites are distinguishable.
 */
export async function igGraphPost(
  host: string,
  path: string,
  body: unknown,
  opts?: { label?: string; maxRetries?: number; retryDelayMs?: number },
): Promise<IgPostResult> {
  const token = config.instagram.token
  if (!token) {
    return { ok: false, error: 'IG_TOKEN not configured' }
  }
  const label = opts?.label ?? 'ig-graph'
  const maxRetries = opts?.maxRetries ?? 1
  const retryDelayMs = opts?.retryDelayMs ?? 500
  // Token goes in the URL the same way the canonical Graph SDK does, so
  // a quick browser test of `?access_token=…` works for debugging.
  const url = `${host}${path}${path.includes('?') ? '&' : '?'}access_token=${token}`

  let lastErr: { status?: number; message: string } | undefined
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        return { ok: true, status: res.status, data }
      }
      const text = await res.text().catch(() => '<unreadable>')
      lastErr = { status: res.status, message: text.slice(0, 200) }
      if (attempt === maxRetries || !RETRYABLE.has(res.status)) break
      console.warn(`[instagram:${label}] attempt ${attempt + 1} failed (HTTP ${res.status}); retrying in ${retryDelayMs}ms`)
      await sleep(retryDelayMs)
    } catch (err) {
      lastErr = { message: (err as Error).message }
      if (attempt === maxRetries) break
      console.warn(`[instagram:${label}] attempt ${attempt + 1} threw (${lastErr.message}); retrying in ${retryDelayMs}ms`)
      await sleep(retryDelayMs)
    }
  }
  console.warn(`[instagram:${label}] failed: ${lastErr?.status ?? 'no-status'} ${lastErr?.message ?? ''}`)
  return { ok: false, status: lastErr?.status, error: lastErr?.message ?? 'unknown' }
}
