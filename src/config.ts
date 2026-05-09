// Single config seam. All env access flows through here so we can reason about
// what the app needs to start. Channels are individually optional — the server
// runs if any single channel is configured.

import { envGet, envBool } from './lib/env.ts'

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
    owner: { token: envGet('TG_OWNER_BOT_TOKEN'), chatId: envGet('TG_OWNER_CHAT_ID') },
    concierge: { token: envGet('TG_CONCIERGE_BOT_TOKEN') },
    kitchen: { token: envGet('TG_KITCHEN_BOT_TOKEN') },
    marketing: { token: envGet('TG_MARKETING_BOT_TOKEN') },
  },

  whatsapp: {
    phoneNumberId: envGet('WA_PHONE_NUMBER_ID'),
    token: envGet('WA_TOKEN'),
    verifyToken: envGet('WA_VERIFY_TOKEN') ?? 'happycake_verify_2026',
    wabaId: envGet('WA_BUSINESS_ACCOUNT_ID'),
  },

  instagram: {
    userId: envGet('IG_USER_ID'),
    token: envGet('IG_TOKEN'),
    appId: envGet('IG_APP_ID'),
    appSecret: envGet('IG_APP_SECRET'),
    verifyToken: envGet('IG_VERIFY_TOKEN') ?? 'happycake_verify_2026',
  },

  db: {
    path: envGet('DB_PATH') ?? '.data/happycake.db',
  },

  features: {
    worldScenario: envBool('WORLD_SCENARIO_ENABLED', false),
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
