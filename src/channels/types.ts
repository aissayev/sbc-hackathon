// Normalized message shape — every channel adapter produces this, the agent
// router consumes only this. New channels add an adapter, never touch the agent.

export type Channel = 'whatsapp' | 'instagram' | 'web' | 'telegram'

// One agent role per inbound type. Used by the router to pick a prompt.
export type AgentRole = 'concierge' | 'kitchen' | 'marketing' | 'owner'

export interface IncomingMessage {
  channel: Channel
  threadId: string
  senderId: string
  senderName?: string
  text: string
  timestamp: number
  raw: unknown
  // Optional hint from webhook layer (e.g. /owner /kitchen slash command in TG)
  roleHint?: AgentRole
}

export interface ChannelAdapter {
  readonly channel: Channel
  send(threadId: string, text: string): Promise<void>
}

export type MessageHandler = (msg: IncomingMessage) => Promise<void>

// Replies keyed by channel for the in-process web channel (used by /api/chat).
export interface ChannelOutbox {
  drain(threadId: string): string[]
}
