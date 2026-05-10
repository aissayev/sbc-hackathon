// Two channel-less entry points: /test/incoming for the evaluator (accepts a
// raw IncomingMessage shape) and /api/chat for the on-site assistant. Both
// share the onMessage + webAdapter.drain pattern — the agent posts to the
// web channel's outbound queue and we drain it back into the response body.

import { Hono } from 'hono'
import { webAdapter } from '../channels/web.ts'
import type { IncomingMessage, MessageHandler } from '../channels/types.ts'

export function createTestRoutes(onMessage: MessageHandler) {
  const r = new Hono()

  r.post('/test/incoming', async (c) => {
    const body = (await c.req.json()) as Partial<IncomingMessage>
    if (!body.text || !body.threadId) return c.json({ error: 'text, threadId required' }, 400)
    const msg: IncomingMessage = {
      channel: body.channel ?? 'web',
      threadId: body.threadId,
      senderId: body.senderId ?? body.threadId,
      senderName: body.senderName,
      text: body.text,
      timestamp: body.timestamp ?? Date.now(),
      raw: body,
      roleHint: body.roleHint,
    }
    await onMessage(msg)
    const replies = msg.channel === 'web' ? webAdapter.drain(msg.threadId) : []
    return c.json({ thread_id: msg.threadId, replies })
  })

  r.post('/api/chat', async (c) => {
    const body = (await c.req.json()) as { thread_id?: string; text?: string; sender_name?: string }
    if (!body.text) return c.json({ error: 'text required' }, 400)
    const threadId = body.thread_id ?? `web_${Math.random().toString(36).slice(2, 10)}`
    await onMessage({
      channel: 'web',
      threadId,
      senderId: threadId,
      senderName: body.sender_name,
      text: body.text,
      timestamp: Date.now(),
      raw: body,
    })
    const replies = webAdapter.drain(threadId)
    return c.json({ thread_id: threadId, replies })
  })

  return r
}
