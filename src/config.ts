// Single config seam. All env access flows through here so we can reason about
// what the app needs to start. Channels are individually optional — the server
// runs if any single channel is configured.

import { envGet, envBool } from './lib/env.ts'

function parseChatIds(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

// Multi-owner whitelist parsed once: TG_OWNER_CHAT_IDS preferred (comma-
// separated), legacy TG_OWNER_CHAT_ID falls back. The first entry is also
// exposed as `chatId` (singular) so older single-recipient call sites
// (src/bots/owner/log.ts, cards.ts, src/agent/router.ts) keep working
// without a sweep.
const _ownerChatIds = parseChatIds(envGet('TG_OWNER_CHAT_IDS') ?? envGet('TG_OWNER_CHAT_ID'))

export const config = {
  port: Number(envGet('PORT') ?? 3000),
  publicUrl: envGet('PUBLIC_URL'),

  sandbox: {
    mcpUrl: envGet('SBC_MCP_URL') ?? 'https://www.steppebusinessclub.com/api/mcp',
    teamToken: envGet('SBC_TEAM_TOKEN'),
  },

  agent: {
    enabled: envBool('AGENT_ENABLED', true),
    bin: envGet('CLAUDE_BIN') ?? 'claude',
    model: envGet('CLAUDE_MODEL') ?? 'claude-opus-4-7',
    maxBudgetUsd: Number(envGet('CLAUDE_MAX_BUDGET_USD') ?? '2.50'),
  },

  telegram: {
    owner: {
      token: envGet('TG_OWNER_BOT_TOKEN'),
      // ⚠️ HACKATHON-MODE OPEN ACCESS:
      // When `chatIds` is empty, the owner bot accepts inbound from ANY
      // chat (so we can iterate fast while collecting team chat ids). For
      // production this MUST become a closed whitelist — anyone who finds
      // the bot URL could otherwise approve drafts. The boot-time logger
      // surfaces a clear "OPEN MODE" warning when the list is empty.
      chatIds: _ownerChatIds,
      chatId: _ownerChatIds[0], // back-compat for single-owner callers
    },
    concierge: { token: envGet('TG_CONCIERGE_BOT_TOKEN') },
    kitchen: { token: envGet('TG_KITCHEN_BOT_TOKEN') },
    marketing: { token: envGet('TG_MARKETING_BOT_TOKEN') },
  },

  whatsapp: {
    phoneNumberId: envGet('WA_PHONE_NUMBER_ID'),
    token: envGet('WA_TOKEN'),
    verifyToken: envGet('WA_VERIFY_TOKEN') ?? 'happycake_verify_2026',
    wabaId: envGet('WA_BUSINESS_ACCOUNT_ID'),
    // Meta App Secret for HMAC signature verification on inbound webhooks.
    // When unset, sandbox-injected unsigned bodies are accepted (dev path).
    appSecret: envGet('WA_APP_SECRET'),
    // 'real' = Meta Cloud API only (human demo).
    // 'sandbox' = sandbox MCP `whatsapp_send` only (eval scoring).
    // 'both' = call both backends in parallel (default — best for the hackathon).
    outboundMode: (envGet('WA_OUTBOUND_MODE') ?? 'both') as 'real' | 'sandbox' | 'both',
  },

  instagram: {
    userId: envGet('IG_USER_ID'),
    token: envGet('IG_TOKEN'),
    appId: envGet('IG_APP_ID'),
    appSecret: envGet('IG_APP_SECRET'),
    verifyToken: envGet('IG_VERIFY_TOKEN') ?? 'happycake_verify_2026',
    outboundMode: (envGet('IG_OUTBOUND_MODE') ?? 'both') as 'real' | 'sandbox' | 'both',
  },

  db: {
    path: envGet('DB_PATH') ?? '.data/happycake.db',
  },

  features: {
    worldScenario: envBool('WORLD_SCENARIO_ENABLED', false),
  },

  catalog: {
    // How often the backend re-pulls `square_list_catalog` from the sandbox MCP
    // and refreshes the local SQLite mirror. 0 disables periodic sync (still
    // syncs once at startup).
    syncIntervalMs: Number(envGet('CATALOG_SYNC_INTERVAL_MS') ?? 5 * 60 * 1000),
    // Shared secret required to call POST /api/catalog/sync. Unset = endpoint
    // disabled (only programmatic + scheduled refresh allowed).
    syncSecret: envGet('CATALOG_SYNC_SECRET'),
  },

  web: {
    // Shared secret for the Next.js SSR layer to authenticate against the
    // Hono backend's /api/admin/* endpoints. Set on BOTH sides
    // (web/.env: WEB_BACKEND_SECRET, backend/.env.local: same). Unset =
    // server-side admin reads ride open mode (see admin-auth middleware).
    backendSecret: envGet('WEB_BACKEND_SECRET'),
  },

  elevenlabs: {
    // Used for Telegram voice-message transcription. When unset, voice
    // messages get a "voice transcription not configured" reply instead of
    // being silently dropped.
    apiKey: envGet('ELEVENLABS_API_KEY'),
    // scribe_v2 (default) is newer + supports filler-word stripping.
    // scribe_v1 is the older stable model. Both are multilingual (99 langs
    // including Russian, English, Kazakh).
    sttModel: envGet('ELEVENLABS_STT_MODEL') ?? 'scribe_v2',
  },
} as const

export function configuredChannels(): string[] {
  const out: string[] = []
  if (config.whatsapp.token) out.push('whatsapp')
  if (config.instagram.token) out.push('instagram')
  if (config.telegram.concierge.token || config.telegram.owner.token) out.push('telegram')
  out.push('web') // always available
  return out
}
