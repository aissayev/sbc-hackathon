// Instagram outbound surface — text DM + sender actions + comment reply.
//
// Two backends as before (real Graph API + sandbox MCP), controlled by
// IG_OUTBOUND_MODE. The adapter `send()` method is unchanged externally
// so existing consumers (channel router, world scripts) keep working.
//
// New surface beyond plain text:
//   - markSeen(threadId)   — fires the read receipt so the customer sees us
//                            as engaged within seconds of receiving
//   - setTyping(threadId, on)  — IG's `typing_on` indicator (auto-clears
//                            after ~20s, no heartbeat needed for one-shot
//                            replies; pair with a heartbeat for long ones)
//   - replyToComment(commentId, text)  — for IG post comments (not DMs).
//                            The agent's marketing role uses this to engage
//                            on Reels / posts without going to DM.
//
// IG DM length cap is 1000 chars. Long agent replies are split on
// sentence boundaries so the customer reads cleanly instead of seeing
// a single wall of text get truncated mid-sentence.

import { config } from '../../config.ts'
import { tryCallSandboxTool } from '../../lib/sandbox-mcp.ts'
import type { ChannelAdapter } from '../types.ts'
import { IG_DIRECT_HOST, IG_GRAPH_HOST, igGraphPost } from './client.ts'

const IG_DM_MAX_CHARS = 1000

// ─── splitting ─────────────────────────────────────────────────────────

/**
 * Split a long message into IG-DM-friendly chunks. Prefers sentence
 * boundaries (`.`, `?`, `!`, `\n\n`); falls back to hard-cut at the
 * limit only when a single sentence would exceed it. Exported for tests.
 */
export function splitForIg(text: string, max = IG_DM_MAX_CHARS): string[] {
  const t = text.trim()
  if (t.length <= max) return [t]
  // Sentence boundary regex: split before whitespace that follows
  // ./?/!/. Keep punctuation with the left-hand chunk.
  const sentences = t.split(/(?<=[.!?])\s+|\n{2,}/g).filter(Boolean)
  const chunks: string[] = []
  let buf = ''
  for (const s of sentences) {
    const candidate = buf ? `${buf} ${s}` : s
    if (candidate.length <= max) {
      buf = candidate
      continue
    }
    if (buf) chunks.push(buf)
    if (s.length <= max) {
      buf = s
    } else {
      // Single sentence longer than the cap — fall back to hard cuts.
      for (let i = 0; i < s.length; i += max) chunks.push(s.slice(i, i + max))
      buf = ''
    }
  }
  if (buf) chunks.push(buf)
  return chunks
}

// ─── DM text ────────────────────────────────────────────────────────────

async function sendDmReal(threadId: string, text: string): Promise<void> {
  const chunks = splitForIg(text)
  for (const chunk of chunks) {
    const r = await igGraphPost(
      IG_DIRECT_HOST,
      '/me/messages',
      { recipient: { id: threadId }, message: { text: chunk } },
      { label: 'send-dm' },
    )
    // If the API rejects (e.g. "Cannot send message" — outside 24h
    // window), stop sending the rest of the chunks. Owner can pick this
    // up via the cockpit Inbox + audit log.
    if (!r.ok) return
  }
}

async function sendDmSandbox(threadId: string, text: string): Promise<void> {
  // Sandbox accepts the full body in one call.
  await tryCallSandboxTool('instagram_send_dm', { threadId, message: text })
}

export const instagramAdapter: ChannelAdapter = {
  channel: 'instagram',
  async send(threadId, text) {
    const mode = config.instagram.outboundMode
    if (mode === 'real') {
      await sendDmReal(threadId, text)
    } else if (mode === 'sandbox') {
      await sendDmSandbox(threadId, text)
    } else {
      await Promise.allSettled([sendDmReal(threadId, text), sendDmSandbox(threadId, text)])
    }
  },
}

// ─── Sender actions ────────────────────────────────────────────────────

/**
 * Fire the `mark_seen` receipt so the customer sees us as engaged.
 * Best-effort — never throws. Skips when IG isn't configured.
 */
export async function markSeen(threadId: string): Promise<void> {
  await igGraphPost(
    IG_DIRECT_HOST,
    '/me/messages',
    { recipient: { id: threadId }, sender_action: 'mark_seen' },
    { label: 'mark-seen', maxRetries: 0 },
  )
}

/**
 * Toggle the typing indicator. IG's `typing_on` auto-clears after ~20s,
 * which is usually long enough for a single agent reply. For longer
 * runs, call again every 15s — see withIgTyping helper below.
 */
export async function setTyping(threadId: string, on: boolean): Promise<void> {
  await igGraphPost(
    IG_DIRECT_HOST,
    '/me/messages',
    { recipient: { id: threadId }, sender_action: on ? 'typing_on' : 'typing_off' },
    { label: 'typing', maxRetries: 0 },
  )
}

/**
 * Run `fn` while keeping the IG typing indicator visible. IG auto-clears
 * after ~20s; we re-emit every 15s until `fn` resolves or throws. Mirrors
 * the Telegram withTypingIndicator helper, just with a longer interval.
 */
export async function withIgTyping<T>(threadId: string, fn: () => Promise<T>): Promise<T> {
  void setTyping(threadId, true)
  const handle = setInterval(() => void setTyping(threadId, true), 15_000)
  try {
    return await fn()
  } finally {
    clearInterval(handle)
    void setTyping(threadId, false)
  }
}

// ─── Comment reply ─────────────────────────────────────────────────────

/**
 * Reply to a comment on one of our posts/Reels. Different host
 * (graph.facebook.com) since IG comments are Page-resourced. Used by
 * the marketing agent to engage on Reels without dropping to DM.
 *
 * @returns ok=true with `data.id` when the reply was created.
 */
export async function replyToComment(commentId: string, text: string): Promise<{ ok: boolean; replyId?: string; error?: string }> {
  const r = await igGraphPost(
    IG_GRAPH_HOST,
    `/${encodeURIComponent(commentId)}/replies`,
    { message: text },
    { label: 'comment-reply' },
  )
  if (!r.ok) return { ok: false, error: r.error }
  const replyId = (r.data as { id?: string } | undefined)?.id
  return { ok: true, replyId }
}
