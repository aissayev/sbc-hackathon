// Web channel adapter — replies queue per-thread and drain on the next /api/chat call.
// Lets us round-trip without WebSockets or SSE.

import type { ChannelAdapter, ChannelOutbox } from './types.ts'

const queues = new Map<string, string[]>()

export const webAdapter: ChannelAdapter & ChannelOutbox = {
  channel: 'web',
  async send(threadId: string, text: string) {
    const arr = queues.get(threadId) ?? []
    arr.push(text)
    queues.set(threadId, arr)
  },
  drain(threadId: string): string[] {
    const arr = queues.get(threadId) ?? []
    queues.delete(threadId)
    return arr
  },
}
