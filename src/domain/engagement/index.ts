// Engagement bounded context — public surface.

export type { SentimentScore, SentimentLabel } from './sentiment.ts'
export { scoreSentiment, sentimentGlyph } from './sentiment.ts'
export type { EngagementItem, EngagementSource } from './types.ts'
export { listDmInbox, listReviewInbox, summariseSentiment } from './inbox-puller.ts'
