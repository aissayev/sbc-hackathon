// Decides which agent role handles an incoming message.
// Default = concierge (customer-facing). Owner-side messages from the operator
// Telegram bots (e.g. /approve, /today) get routed to the owner role.

import type { AgentRole, IncomingMessage } from '../channels/types.ts'
import { config } from '../config.ts'

export function pickRole(msg: IncomingMessage): AgentRole {
  if (msg.roleHint) return msg.roleHint

  if (msg.channel === 'telegram') {
    // Multi-owner: any chat id in the whitelist wins over slash-command
    // parsing. When the whitelist is empty (open mode) this branch never
    // fires, so messages fall through to slash-command + concierge default.
    if (config.telegram.owner.chatIds.includes(msg.threadId)) {
      return 'owner'
    }
    // Slash-prefixed commands: /kitchen, /marketing — others fall to concierge.
    const trimmed = msg.text.trim().toLowerCase()
    if (trimmed.startsWith('/kitchen')) return 'kitchen'
    if (trimmed.startsWith('/marketing')) return 'marketing'
    if (trimmed.startsWith('/owner') || trimmed.startsWith('/approve') || trimmed.startsWith('/reject')) {
      return 'owner'
    }
  }

  return 'concierge'
}
