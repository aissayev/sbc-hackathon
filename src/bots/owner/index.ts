// Owner-bot barrel.
//
// Existing import sites use `from '../bots/owner.ts'` — the legacy single
// file `src/bots/owner.ts` re-exports from this folder so nothing breaks
// during the split. Once the parallel-agent storm settles, importers can
// migrate to `from '../bots/owner/index.ts'` (or just `from '../bots/owner'`)
// and the legacy `owner.ts` file can be deleted.

export type { BotReply } from './commands.ts'
export {
  isOwnerSlashCommand,
  handleOwnerCommand,
  sendOwnerReply,
} from './commands.ts'
export { handleOwnerCallback } from './callbacks.ts'
export { postDraftOrderCard, postEscalationCard } from './cards.ts'
export { sendOwnerThinking, finalizeOwnerThinking, makeOwnerStreamSink } from './live.ts'
export {
  logToOwner,
  logInbound,
  logOutbound,
  logError,
  logSystem,
  logVoiceTranscription,
} from './log.ts'
export { handleOwnerAsyncCommand } from './inbox-reviews.ts'
