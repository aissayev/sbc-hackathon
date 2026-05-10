// Instagram channel — public surface. Existing imports
// (`from '../channels/instagram'`) keep working because index.ts
// re-exports the same names.
//
// Internal layout:
//   client.ts    — single retry-aware HTTP client (graph.instagram.com + graph.facebook.com)
//   outbound.ts  — adapter `instagramAdapter`, sender actions, comment reply
//   inbound.ts   — discriminated webhook parser (text / image / postback / reaction / read / story / echo)
//   types.ts     — IgEvent + IgWebhookPayload shapes

import { parseInstagram as parseInstagramFull } from './inbound.ts'
import type { IgWebhookPayload } from './types.ts'
import type { IncomingMessage } from '../types.ts'

export { instagramAdapter, markSeen, setTyping, withIgTyping, replyToComment, splitForIg } from './outbound.ts'
export type { IgEvent, IgTextEvent, IgImageEvent, IgPostbackEvent, IgReactionEvent, IgReadEvent, IgStoryEvent, IgEchoEvent, IgWebhookPayload } from './types.ts'
export { parseInstagram as parseInstagramRich } from './inbound.ts'

/**
 * Back-compat wrapper for callers that only care about IncomingMessage[].
 * Existing code in src/routes/webhooks.ts uses this. New code should
 * prefer `parseInstagramRich` to get the full discriminated union.
 */
export function parseInstagram(body: IgWebhookPayload, ourPageId?: string): IncomingMessage[] {
  return parseInstagramFull(body, ourPageId).messages
}
