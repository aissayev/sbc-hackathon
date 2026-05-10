// WhatsApp adapter — sandbox-only for the hackathon.
//
// Real WA Cloud API path already lives in src/channels/whatsapp.ts (gated by
// WA_OUTBOUND_MODE=real|sandbox|both). This adapter is the *content-studio*
// view, used for owner-initiated broadcasts. For 1:1 customer replies we go
// through the channel adapter (different surface, different ratelimit).
//
// To wire real broadcast after the hackathon:
//   - Approved Meta WhatsApp Business template (one-off opt-in/out broadcasts
//     require a Marketing-category template).
//   - Loop over recipient list and POST to graph.facebook.com/v25.0/<phone-id>/messages
//     with `template` payload. Rate-limit at ~250 msgs/sec (tier 2+).
//   - Track delivery receipts on the same /webhooks/whatsapp endpoint we
//     already have (status updates carry message_status field).

import { tryCallSandboxTool } from '../../../lib/sandbox-mcp.ts'
import type {
  PublishAdapter,
  BroadcastInput,
  PublishResult,
} from './types.ts'

export const waAdapter: PublishAdapter = {
  name: 'wa:sandbox',

  async post(): Promise<PublishResult> {
    // WhatsApp doesn't have a "post" surface — only DMs and broadcasts.
    return { ok: false, error: 'wa_post_unsupported' }
  },

  async broadcast(input: BroadcastInput): Promise<PublishResult> {
    // Sandbox doesn't yet expose a real broadcast tool, so we send to a list
    // pulled from the local DB (recent_30d / opted_in_customers) and call
    // whatsapp_send per recipient. The publish_receipt_json captures the
    // count + any per-recipient errors.
    //
    // For Phase 1 we keep this as a placeholder that returns a stub success
    // with a TODO for the audience expansion. The owner cockpit will not
    // surface the broadcast button until this is fleshed out (Phase 4).
    const result = await tryCallSandboxTool('whatsapp_send', {
      to: 'broadcast_audience_placeholder',
      message: input.message,
    })
    return resultFrom(result)
  },
}

function resultFrom(raw: unknown): PublishResult {
  if (raw == null) return { ok: false, error: 'sandbox_unavailable' }
  const obj = raw as { id?: string; error?: string }
  if (obj.error) return { ok: false, error: obj.error, raw }
  return { ok: true, remote_id: obj.id, raw }
}
