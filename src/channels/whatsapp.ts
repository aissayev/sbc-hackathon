// WhatsApp Cloud API adapter — outbound send + inbound webhook parser.
// Real WhatsApp (Meta Cloud API) is one channel. The sandbox MCP exposes
// `whatsapp_send` and `whatsapp_inject_inbound` for the simulator path.
// Both end up as `IncomingMessage` shapes flowing through `onMessage`.

import { config } from '../config.ts'
import type { ChannelAdapter, IncomingMessage } from './types.ts'

const GRAPH_API = 'https://graph.facebook.com/v25.0'

export const whatsappAdapter: ChannelAdapter = {
  channel: 'whatsapp',
  async send(threadId, text) {
    if (!config.whatsapp.phoneNumberId || !config.whatsapp.token) {
      console.warn('[whatsapp] not configured; skipping send')
      return
    }
    const url = `${GRAPH_API}/${config.whatsapp.phoneNumberId}/messages`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.whatsapp.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: threadId,
        type: 'text',
        text: { body: text },
      }),
    })
    if (!res.ok) {
      throw new Error(`WhatsApp send failed: ${res.status} ${await res.text()}`)
    }
  },
}

interface WhatsAppPayload {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          from: string
          id: string
          timestamp: string
          text?: { body: string }
          type: string
        }>
        contacts?: Array<{ wa_id: string; profile?: { name?: string } }>
      }
    }>
  }>
}

export function parseWhatsApp(body: WhatsAppPayload): IncomingMessage[] {
  const messages: IncomingMessage[] = []
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value
      if (!value?.messages) continue
      const contacts = value.contacts ?? []
      for (const m of value.messages) {
        if (m.type !== 'text' || !m.text) continue
        const contact = contacts.find((c) => c.wa_id === m.from)
        messages.push({
          channel: 'whatsapp',
          threadId: m.from,
          senderId: m.from,
          senderName: contact?.profile?.name,
          text: m.text.body,
          timestamp: Number(m.timestamp) * 1000,
          raw: m,
        })
      }
    }
  }
  return messages
}
