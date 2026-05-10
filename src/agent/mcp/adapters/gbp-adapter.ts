// Google Business Profile adapter — sandbox-only for the hackathon.
//
// Hackathon mode: every call goes through `gb_simulate_post` /
// `gb_simulate_reply` on the sandbox MCP. That's by design — the rubric
// scores us on MCP usage, and we don't have a real GBP location yet.
//
// To wire the real GBP API after the hackathon:
//   1. Add `GBP_LOCATION_ID` and `GBP_OAUTH_TOKEN` to .env (OAuth via
//      the Business Profile API; service-account access isn't supported).
//   2. Replace the `tryCallSandboxTool` calls below with the matching
//      Business Information API endpoints:
//        post()           → POST  /v4/{name=accounts/*/locations/*}/localPosts
//        reply_to_review  → PUT   /v4/{name=accounts/*/locations/*/reviews/*}/reply
//      docs: https://developers.google.com/my-business/reference/rest
//   3. Keep the same PublishResult shape — the rest of the system only
//      cares about the interface, not the transport.

import { tryCallSandboxTool } from '../../../lib/sandbox-mcp.ts'
import type {
  PublishAdapter,
  PostInput,
  ReviewReplyInput,
  PublishResult,
} from './types.ts'

export const gbpAdapter: PublishAdapter = {
  name: 'gbp:sandbox',

  async post(input: PostInput): Promise<PublishResult> {
    // Sandbox tool name verified live: `gb_simulate_post` accepts `content`,
    // optional `cta_url`, optional `media_url`. See docs/00-source/mcp-tools.json.
    const result = await tryCallSandboxTool('gb_simulate_post', {
      content: input.caption,
      ...(input.media_urls[0] ? { media_url: input.media_urls[0] } : {}),
    })
    return resultFrom(result)
  },

  async reply_to_review(input: ReviewReplyInput): Promise<PublishResult> {
    const result = await tryCallSandboxTool('gb_simulate_reply', {
      review_id: input.review_remote_id,
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
