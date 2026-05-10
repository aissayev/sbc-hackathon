// Adapter registry. Domain services depend on PublishAdapter, never on a
// specific transport. Default registry returns the sandbox-MCP adapters; a
// future real-Meta build flips one constant and the rest of the system
// keeps working unchanged.

import type { PublishAdapter } from './types.ts'
import { gbpAdapter } from './gbp-adapter.ts'
import { igAdapter } from './ig-adapter.ts'
import { waAdapter } from './wa-adapter.ts'

export type ChannelKey = 'ig' | 'fb' | 'gbp' | 'wa'

const ADAPTERS: Record<ChannelKey, PublishAdapter> = {
  ig: igAdapter,
  // For the hackathon we treat FB as an alias for IG (sandbox doesn't model
  // them separately and the brief lumps them as "Meta"). When the real
  // Graph API lands, swap this for a dedicated fb-adapter.ts.
  fb: igAdapter,
  gbp: gbpAdapter,
  wa: waAdapter,
}

export function getAdapter(channel: ChannelKey): PublishAdapter {
  return ADAPTERS[channel]
}

export function listAdapters(): ReadonlyArray<{ channel: ChannelKey; name: string }> {
  return (Object.entries(ADAPTERS) as Array<[ChannelKey, PublishAdapter]>).map(([c, a]) => ({
    channel: c,
    name: a.name,
  }))
}

export type { PublishAdapter, PublishResult, PostInput, ReelInput, CommentReplyInput, ReviewReplyInput, BroadcastInput } from './types.ts'
