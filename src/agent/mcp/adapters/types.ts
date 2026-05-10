// Adapter interfaces for the publish surfaces (IG, FB, GBP, WA).
//
// Why this file exists: the rest of the codebase depends on these interfaces,
// not on `tryCallSandboxTool` directly. That keeps the domain layer clean
// (DDD) and makes it trivial to swap the sandbox MCP for real Meta / GBP /
// Twilio APIs after the hackathon — see comments in each adapter file.

export interface PublishResult {
  ok: boolean
  remote_id?: string
  url?: string
  error?: string
  raw?: unknown
}

export interface PostInput {
  caption: string
  media_urls: string[]
  channel: 'ig' | 'fb' | 'gbp' | 'multi'
  scheduled_for?: number
}

export interface ReelInput {
  caption: string
  video_url?: string
  hook?: string
  voiceover?: string
  scheduled_for?: number
}

export interface CommentReplyInput {
  comment_remote_id: string
  reply_text: string
}

export interface ReviewReplyInput {
  review_remote_id: string
  reply_text: string
  rating?: number
}

export interface BroadcastInput {
  audience: 'opted_in_customers' | 'recent_30d' | string
  message: string
}

export interface PublishAdapter {
  name: string
  post(input: PostInput): Promise<PublishResult>
  reel?(input: ReelInput): Promise<PublishResult>
  reply_to_comment?(input: CommentReplyInput): Promise<PublishResult>
  reply_to_review?(input: ReviewReplyInput): Promise<PublishResult>
  broadcast?(input: BroadcastInput): Promise<PublishResult>
}
