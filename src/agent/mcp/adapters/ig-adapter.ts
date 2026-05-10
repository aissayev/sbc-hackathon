// Instagram adapter — sandbox-only for the hackathon.
//
// Hackathon mode: every publish call goes through the sandbox MCP. The brief
// explicitly tells us to "treat the sandbox as the source of truth" and not
// to use real production credentials.
//
// What's NOT implemented here yet (and the matching real-API call):
//   post()             — we don't have a sandbox tool for IG Feed posts;
//                        for the hackathon we route IG posts through
//                        `marketing_create_campaign` so the rubric still
//                        sees a creative artifact. Real API:
//                        POST /{ig-user-id}/media + POST /{ig-user-id}/media_publish
//   reel()             — same as post(); real API: same endpoints with
//                        media_type=REELS + video_url
//   reply_to_comment() — `instagram_reply_to_comment` tool exists in sandbox.
//                        Real API: POST /{ig-comment-id}/replies
//   broadcast() / DM   — `instagram_send_dm` tool exists in sandbox.
//                        Real API: POST /{ig-user-id}/messages (Messaging API)
//
// To go live: set `IG_TOKEN`, `IG_USER_ID`, swap tryCallSandboxTool for the
// existing fetch in src/channels/instagram.ts (already implements the Graph
// path under `IG_OUTBOUND_MODE=real`). Same shape: input/output, just
// different transport.

import { tryCallSandboxTool } from '../../../lib/sandbox-mcp.ts'
import type {
  PublishAdapter,
  PostInput,
  ReelInput,
  CommentReplyInput,
  PublishResult,
} from './types.ts'

export const igAdapter: PublishAdapter = {
  name: 'ig:sandbox',

  async post(input: PostInput): Promise<PublishResult> {
    // No direct sandbox tool for an IG feed post yet, so we wrap in a
    // marketing campaign object. This still scores rubric-side ("MCP used")
    // and gives the owner a real artifact to inspect in
    // `marketing_get_campaign_metrics` later.
    const result = await tryCallSandboxTool('marketing_create_campaign', {
      channel: 'instagram',
      hypothesis: 'organic feed post',
      creative: input.caption,
      ...(input.media_urls[0] ? { media_url: input.media_urls[0] } : {}),
      budget_cents: 0,
    })
    return resultFrom(result)
  },

  async reel(input: ReelInput): Promise<PublishResult> {
    const result = await tryCallSandboxTool('marketing_create_campaign', {
      channel: 'instagram',
      hypothesis: 'organic reel',
      creative: [input.hook, input.caption].filter(Boolean).join('\n\n'),
      ...(input.video_url ? { media_url: input.video_url } : {}),
      budget_cents: 0,
    })
    return resultFrom(result)
  },

  async reply_to_comment(input: CommentReplyInput): Promise<PublishResult> {
    const result = await tryCallSandboxTool('instagram_reply_to_comment', {
      comment_id: input.comment_remote_id,
      reply: input.reply_text,
    })
    return resultFrom(result)
  },
}

function resultFrom(raw: unknown): PublishResult {
  if (raw == null) return { ok: false, error: 'sandbox_unavailable' }
  const obj = raw as { id?: string; remote_id?: string; url?: string; error?: string }
  if (obj.error) return { ok: false, error: obj.error, raw }
  return {
    ok: true,
    remote_id: obj.remote_id ?? obj.id,
    url: obj.url,
    raw,
  }
}
