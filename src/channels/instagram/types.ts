// Inbound event shapes for the Instagram channel.
//
// Meta's webhook payload mixes several event types into one `messaging`
// array (DMs, postbacks, reactions, read receipts, story mentions). We
// parse them into a discriminated union so consumers don't have to
// re-derive the kind.

export interface IgEventBase {
  threadId: string
  senderId: string
  timestamp: number
  raw: unknown
}

export interface IgTextEvent extends IgEventBase {
  kind: 'text'
  text: string
  mid: string
}

// Inbound media: customers commonly DM us a photo of a cake they want
// us to recreate. We can't send the image bytes through the agent yet,
// but we surface the URL + caption so the concierge can acknowledge it
// and route to a human-in-the-loop path.
export interface IgImageEvent extends IgEventBase {
  kind: 'image'
  mid: string
  imageUrl?: string
  caption?: string
}

export interface IgPostbackEvent extends IgEventBase {
  kind: 'postback'
  mid: string
  title?: string
  payload?: string
}

export interface IgReactionEvent extends IgEventBase {
  kind: 'reaction'
  mid: string
  action: 'react' | 'unreact' | string
  reaction?: string
  emoji?: string
}

export interface IgReadEvent extends IgEventBase {
  kind: 'read'
  mid: string
}

// Story replies (reply_to.story_id present) and story mentions
// (attachment with type='story_mention'). We collapse both into one
// event since the response is the same: thank them + offer to chat.
export interface IgStoryEvent extends IgEventBase {
  kind: 'story'
  mid: string
  storyId?: string
  text?: string
}

// Outbound echo — Meta sends our own outbound back as `is_echo: true`.
// Useful for delivery confirmation; the parser flags it but consumers
// usually drop it.
export interface IgEchoEvent extends IgEventBase {
  kind: 'echo'
  mid: string
  text?: string
}

export type IgEvent =
  | IgTextEvent
  | IgImageEvent
  | IgPostbackEvent
  | IgReactionEvent
  | IgReadEvent
  | IgStoryEvent
  | IgEchoEvent

// Wire shape — what Meta actually POSTs to /webhooks/instagram.
// Kept loose because Meta adds fields without warning; we only narrow
// what we use, and ignore the rest.
export interface IgWebhookPayload {
  entry?: Array<{
    id: string
    time?: number
    messaging?: Array<{
      sender?: { id: string }
      recipient?: { id: string }
      timestamp: number
      message?: {
        mid: string
        text?: string
        is_echo?: boolean
        attachments?: Array<{
          type: 'image' | 'video' | 'audio' | 'file' | 'story_mention' | string
          payload?: { url?: string; sticker_id?: string }
        }>
        reply_to?: { mid?: string; story?: { id?: string; url?: string } }
      }
      read?: { mid: string }
      postback?: { mid: string; title?: string; payload?: string }
      reaction?: {
        mid: string
        action: 'react' | 'unreact' | string
        reaction?: string
        emoji?: string
      }
    }>
  }>
}
