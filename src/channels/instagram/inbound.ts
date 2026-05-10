// Instagram webhook parser.
//
// Returns a discriminated union (IgEvent[]) plus the back-compat
// IncomingMessage[] for the existing channel router. Consumers that
// want to react to non-text events (image attachments, postbacks,
// reactions) read from `events`; consumers that just want text DMs
// (the agent runtime) read from `messages`.
//
// We never silently drop non-text events any more — they're surfaced
// either as their own event type, or (for image / story) as a synthetic
// IncomingMessage so the agent can acknowledge.

import type { IncomingMessage } from '../types.ts'
import type {
  IgEvent, IgEventBase, IgWebhookPayload,
  IgEchoEvent, IgImageEvent, IgPostbackEvent,
  IgReactionEvent, IgReadEvent, IgStoryEvent, IgTextEvent,
} from './types.ts'

export interface IgParseResult {
  events: IgEvent[]
  // Back-compat: text DMs + synthetic prompts for image / story so the
  // agent runtime sees them as messages it can route.
  messages: IncomingMessage[]
}

export function parseInstagram(body: IgWebhookPayload, ourPageId?: string): IgParseResult {
  const events: IgEvent[] = []
  const messages: IncomingMessage[] = []

  for (const entry of body.entry ?? []) {
    for (const m of entry.messaging ?? []) {
      const senderId = m.sender?.id
      if (!senderId) continue
      // Filter our own outbound (echoes from our own page) — but track them
      // as 'echo' events so consumers who care (cockpit audit) can see them.
      if (ourPageId && senderId === ourPageId && m.message?.is_echo !== true) continue

      const base: IgEventBase = {
        threadId: senderId,
        senderId,
        timestamp: m.timestamp,
        raw: m,
      }

      // ── Read receipts ──
      if (m.read) {
        events.push({ ...base, kind: 'read', mid: m.read.mid } as IgReadEvent)
        continue
      }

      // ── Postbacks (button taps in templates) ──
      if (m.postback) {
        events.push({
          ...base, kind: 'postback', mid: m.postback.mid,
          title: m.postback.title, payload: m.postback.payload,
        } as IgPostbackEvent)
        // Surface the payload as text so the agent can react.
        const text = m.postback.title ?? m.postback.payload
        if (text) {
          messages.push({
            channel: 'instagram', threadId: senderId, senderId,
            text, timestamp: m.timestamp, raw: m,
          })
        }
        continue
      }

      // ── Reactions (heart, thumbs, etc.) ──
      if (m.reaction) {
        events.push({
          ...base, kind: 'reaction', mid: m.reaction.mid,
          action: m.reaction.action, reaction: m.reaction.reaction, emoji: m.reaction.emoji,
        } as IgReactionEvent)
        continue
      }

      // ── Messages ──
      const msg = m.message
      if (!msg) continue

      // Echo (our own outbound bouncing back) — track and drop.
      if (msg.is_echo) {
        events.push({
          ...base, kind: 'echo', mid: msg.mid, text: msg.text,
        } as IgEchoEvent)
        continue
      }

      // Story replies / mentions — collapse into one event.
      const storyId = msg.reply_to?.story?.id
      const isStoryMention = msg.attachments?.some((a) => a.type === 'story_mention')
      if (storyId || isStoryMention) {
        events.push({
          ...base, kind: 'story', mid: msg.mid,
          storyId, text: msg.text,
        } as IgStoryEvent)
        // Synthesise a message so the agent thanks the customer + offers to chat.
        messages.push({
          channel: 'instagram', threadId: senderId, senderId,
          text: msg.text || '[story mention]',
          timestamp: m.timestamp, raw: m,
        })
        continue
      }

      // Image attachment (no text, just a photo). Bakery-relevant: most
      // common case is a customer sharing a reference cake photo.
      const imageAttachment = msg.attachments?.find((a) => a.type === 'image')
      if (imageAttachment && !msg.text) {
        events.push({
          ...base, kind: 'image', mid: msg.mid,
          imageUrl: imageAttachment.payload?.url,
          caption: msg.text,
        } as IgImageEvent)
        // Synthesise a hint so the concierge can acknowledge + escalate
        // to a custom-cake design conversation.
        messages.push({
          channel: 'instagram', threadId: senderId, senderId,
          text: '[customer shared an image — likely a reference photo for a custom cake]',
          timestamp: m.timestamp, raw: m,
        })
        continue
      }

      // Plain text DM (the common case).
      if (msg.text) {
        events.push({
          ...base, kind: 'text', mid: msg.mid, text: msg.text,
        } as IgTextEvent)
        messages.push({
          channel: 'instagram', threadId: senderId, senderId,
          text: msg.text, timestamp: m.timestamp, raw: m,
        })
      }
    }
  }

  return { events, messages }
}
