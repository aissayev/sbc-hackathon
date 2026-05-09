// WhatsApp adapter — dual-path outbound + inbound webhook parser.
//
// Outbound modes (controlled by WA_OUTBOUND_MODE in .env):
//   real     — Meta Cloud API only (graph.facebook.com). For human demos
//              with real customers on real phones.
//   sandbox  — sandbox MCP `whatsapp_send` only. For evaluator scoring;
//              the sandbox needs to see our reply to score channel response.
//   both     — fire both in parallel; failures of either are logged not thrown.
//              Default. Best for the hackathon: works for real customers AND
//              scores well in eval, even if a fake phone number can't be
//              reached by real Cloud API.
//
// Inbound: same `/webhooks/whatsapp` endpoint receives both sandbox-injected
// messages (from `whatsapp_inject_inbound`) and real Cloud API events. The
// payload shape is identical (Meta-format) so we don't distinguish at parse
// time.

import { config } from '../config.ts'
import { tryCallSandboxTool } from '../lib/sandbox-mcp.ts'
import type { ChannelAdapter, IncomingMessage } from './types.ts'

const GRAPH_API = 'https://graph.facebook.com/v25.0'

async function sendViaCloudApi(threadId: string, text: string): Promise<void> {
  if (!config.whatsapp.phoneNumberId || !config.whatsapp.token) {
    console.warn('[whatsapp:real] not configured; skipping send')
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
    // In `both` mode this is expected for sandbox-injected fake numbers.
    // We log + swallow so the sandbox path still completes.
    const body = await res.text().catch(() => '<unreadable>')
    console.warn(`[whatsapp:real] send failed ${res.status} to=${threadId}: ${body.slice(0, 200)}`)
  }
}

async function sendViaSandbox(threadId: string, text: string): Promise<void> {
  // Returns null on failure (logged inside). Common when the recipient isn't
  // a sandbox-tracked customer (e.g. a real WhatsApp number).
  await tryCallSandboxTool('whatsapp_send', { to: threadId, message: text })
}

export const whatsappAdapter: ChannelAdapter = {
  channel: 'whatsapp',
  async send(threadId, text) {
    const mode = config.whatsapp.outboundMode
    if (mode === 'real') {
      await sendViaCloudApi(threadId, text)
    } else if (mode === 'sandbox') {
      await sendViaSandbox(threadId, text)
    } else {
      // 'both' — fire in parallel, swallow individual failures so one path
      // doesn't break the other. Both paths log their own errors.
      await Promise.allSettled([sendViaCloudApi(threadId, text), sendViaSandbox(threadId, text)])
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
