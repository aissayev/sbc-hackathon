// Cockpit Settings page data. Read-only — environment booleans (which
// secrets are wired), webhook URLs, db stats, sandbox host. Never
// returns secret VALUES, only presence.

import { config } from '../config.ts'
import { getDb } from '../db/db.ts'

export interface CockpitSettings {
  env: {
    publicUrl: string | null
    sandboxMcpUrl: string | null
    sandboxTeamToken: 'set' | 'unset'
    ownerBotToken: 'set' | 'unset'
    whatsappToken: 'set' | 'unset'
    whatsappPhoneNumberId: string | null
    instagramToken: 'set' | 'unset'
    webBackendSecret: 'set' | 'unset'
    nodeEnv: string
  }
  webhooks: Array<{ channel: string; url: string | null; reachable: boolean }>
  db: {
    path: string
    tables: Array<{ name: string; rows: number }>
  }
}

function present(v: string | undefined | null): 'set' | 'unset' {
  return v && v.trim() ? 'set' : 'unset'
}

function publicWebhook(path: string): string | null {
  if (!config.publicUrl) return null
  return `${config.publicUrl.replace(/\/$/, '')}${path}`
}

function safeRowCount(table: string): number {
  try {
    const r = getDb().prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number }
    return r.c
  } catch {
    return 0
  }
}

export function getCockpitSettings(): CockpitSettings {
  const tables = ['products', 'threads', 'orders', 'escalations', 'leads', 'campaigns', 'owner_approvals', 'audit_log', 'agent_invocations']
  return {
    env: {
      publicUrl: config.publicUrl ?? null,
      sandboxMcpUrl: config.sandbox?.mcpUrl ?? null,
      sandboxTeamToken: present(config.sandbox?.teamToken),
      ownerBotToken: present(config.telegram?.owner?.token),
      whatsappToken: present(config.whatsapp?.token),
      whatsappPhoneNumberId: config.whatsapp?.phoneNumberId ?? null,
      instagramToken: present(config.instagram?.token),
      webBackendSecret: present(config.web?.backendSecret),
      nodeEnv: process.env.NODE_ENV ?? 'development',
    },
    webhooks: [
      { channel: 'whatsapp', url: publicWebhook('/webhooks/whatsapp'), reachable: !!config.publicUrl },
      { channel: 'instagram', url: publicWebhook('/webhooks/instagram'), reachable: !!config.publicUrl },
      { channel: 'telegram', url: publicWebhook('/webhooks/telegram'), reachable: !!config.publicUrl },
    ],
    db: {
      path: config.db.path,
      tables: tables.map((t) => ({ name: t, rows: safeRowCount(t) })),
    },
  }
}
