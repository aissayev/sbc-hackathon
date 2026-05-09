// Instagram Graph API (IG-direct) adapter — outbound send + inbound parser.
// Uses the IG-direct endpoint at graph.instagram.com (NOT the Page-level
// graph.facebook.com path), which avoids Page App Review.

import { config } from '../config.ts'
import type { ChannelAdapter, IncomingMessage } from './types.ts'

const IG_GRAPH = 'https://graph.instagram.com/v25.0'

export const instagramAdapter: ChannelAdapter = {
  channel: 'instagram',
  async send(igsid, text) {
    if (!config.instagram.token) {
      console.warn('[instagram] not configured; skipping send')
      return
    }
    const url = `${IG_GRAPH}/me/messages?access_token=${config.instagram.token}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: igsid },
        message: { text },
      }),
    })
    if (!res.ok) {
      throw new Error(`Instagram send failed: ${res.status} ${await res.text()}`)
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
      // Log + skip non-message events. They aren't agent input but are useful in dev logs.
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
