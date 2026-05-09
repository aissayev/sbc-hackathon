// Instagram adapter — dual-path outbound + inbound webhook parser.
//
// Outbound modes (controlled by IG_OUTBOUND_MODE in .env): same shape as WA.
//   real / sandbox / both. Default 'both'.
//
// Real path: graph.instagram.com (IG-direct, not Page-level — avoids App Review).
// Sandbox path: `instagram_send_dm` MCP tool. Note: the IG-direct API takes a
// recipient `id` field; the sandbox tool takes a `threadId`. Both happen to
// be IG Scoped IDs in the inbound payload, so the same string works for both.

import { config } from '../config.ts'
import { tryCallSandboxTool } from '../lib/sandbox-mcp.ts'
import type { ChannelAdapter, IncomingMessage } from './types.ts'

const IG_GRAPH = 'https://graph.instagram.com/v25.0'

async function sendViaIgDirect(threadId: string, text: string): Promise<void> {
  if (!config.instagram.token) {
    console.warn('[instagram:real] not configured; skipping send')
    return
  }
  const url = `${IG_GRAPH}/me/messages?access_token=${config.instagram.token}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { id: threadId }, message: { text } }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '<unreadable>')
    console.warn(`[instagram:real] send failed ${res.status} to=${threadId}: ${body.slice(0, 200)}`)
  }
}

async function sendViaSandbox(threadId: string, text: string): Promise<void> {
  await tryCallSandboxTool('instagram_send_dm', { threadId, message: text })
}

export const instagramAdapter: ChannelAdapter = {
  channel: 'instagram',
  async send(threadId, text) {
    const mode = config.instagram.outboundMode
    if (mode === 'real') {
      await sendViaIgDirect(threadId, text)
    } else if (mode === 'sandbox') {
      await sendViaSandbox(threadId, text)
    } else {
      await Promise.allSettled([sendViaIgDirect(threadId, text), sendViaSandbox(threadId, text)])
    }
  },
}

interface InstagramPayload {
  entry?: Array<{
    id: string
    time?: number
    messaging?: Array<{
      sender?: { id: string }
      recipient?: { id: string }
      timestamp: number
      message?: { mid: string; text?: string; is_echo?: boolean }
      read?: { mid: string }
      postback?: { mid: string; title?: string; payload?: string }
      reaction?: { mid: string; action: string; reaction?: string; emoji?: string }
    }>
  }>
}

export function parseInstagram(body: InstagramPayload, ourPageId?: string): IncomingMessage[] {
  const messages: IncomingMessage[] = []
  for (const entry of body.entry ?? []) {
    for (const m of entry.messaging ?? []) {
      if (m.read) {
        console.log(`👁  [instagram] read receipt mid=${m.read.mid.slice(0, 20)}...`)
        continue
      }
      if (m.postback) {
        console.log(`🔘 [instagram] postback: ${m.postback.title ?? m.postback.payload}`)
        continue
      }
      if (m.reaction) {
        console.log(`${m.reaction.emoji ?? '❤️ '} [instagram] reaction ${m.reaction.action}`)
        continue
      }
      if (!m.message) continue
      if (m.message.is_echo) continue
      if (!m.sender) continue
      if (ourPageId && m.sender.id === ourPageId) continue
      if (!m.message.text) {
        console.log(`📷 [instagram] non-text message from ${m.sender.id}`)
        continue
      }
      messages.push({
        channel: 'instagram',
        threadId: m.sender.id,
        senderId: m.sender.id,
        text: m.message.text,
        timestamp: m.timestamp,
        raw: m,
      })
    }
  }
  return messages
}
