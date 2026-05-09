// Legacy single-file barrel — re-exports the split modules under owner/.
// All concerns now live in src/bots/owner/{commands,callbacks,cards,format}.ts.
// Keep this file so existing import paths (`from '../bots/owner.ts'`) keep
// working without churn during the parallel-agent build.

export type { BotReply } from './owner/index.ts'
export {
  isOwnerSlashCommand,
  handleOwnerCommand,
  sendOwnerReply,
  handleOwnerCallback,
  postDraftOrderCard,
  postEscalationCard,
  sendOwnerThinking,
  finalizeOwnerThinking,
} from './owner/index.ts'
