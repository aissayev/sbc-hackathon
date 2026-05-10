// Read-only loader for the marketing plan (data/campaigns/plans.json).
//
// Two callers:
//   1. src/scripts/marketing-run.ts — uses the structured plan to drive
//      `marketing_create_campaign` + `marketing_launch_simulated_campaign`.
//   2. src/bots/owner/commands.ts — surfaces the plan in Telegram via
//      /campaigns so the operator sees what's planned, what's launched,
//      and can one-tap approve.
//
// Status comes from data/campaigns/.state/last-run.json (written after
// `bun run marketing:run` and after each owner-approved Telegram launch).
//
// Pure loader — no MCP calls here. The HTTP MCP transport lives in
// src/lib/sandbox-mcp.ts and is used by callers (not by this module).

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

export interface CampaignPlan {
  id: string
  name: string
  lever: string
  channel: 'instagram' | 'google_local' | 'whatsapp' | 'website' | 'mixed'
  objective: string
  budgetUsd: number
  icp: string[]
  anchorSku: string
  supportingSkus: string[]
  offer: string
  landingPath: string
  creativeStrategy: string
  audienceSizing?: string
  hypothesis: Record<string, unknown>
  killThreshold: string
  scaleThreshold: string
  ownerApprovalRequired: boolean
}

export interface CampaignsFile {
  version: number
  lastReviewed: string
  constraint: {
    monthlyBudgetUsd: number
    targetEffectUsd: number
    challenge: string
  }
  campaigns: CampaignPlan[]
  totalAllocatedUsd: number
  reservedUsd: number
  budgetSummary: Record<string, number>
}

export interface CampaignRunState {
  ranAt: string
  launched: Array<{
    planId: string
    campaignId: string | null
    leadsGenerated: number
  }>
}

const PLANS_PATH = resolve('data/campaigns/plans.json')
const STATE_PATH = resolve('data/campaigns/.state/last-run.json')

export function loadCampaignsFile(): CampaignsFile {
  const raw = readFileSync(PLANS_PATH, 'utf8')
  return JSON.parse(raw) as CampaignsFile
}

export function loadCampaignRunState(): CampaignRunState | null {
  if (!existsSync(STATE_PATH)) return null
  try {
    return JSON.parse(readFileSync(STATE_PATH, 'utf8')) as CampaignRunState
  } catch {
    return null
  }
}

export type CampaignStatus = 'planned' | 'launched' | 'unknown'

export function statusForPlan(planId: string, state: CampaignRunState | null): {
  status: CampaignStatus
  campaignId: string | null
  leadsGenerated: number
} {
  if (!state) return { status: 'planned', campaignId: null, leadsGenerated: 0 }
  const entry = state.launched.find((l) => l.planId === planId)
  if (!entry) return { status: 'planned', campaignId: null, leadsGenerated: 0 }
  if (entry.campaignId) {
    return {
      status: 'launched',
      campaignId: entry.campaignId,
      leadsGenerated: entry.leadsGenerated,
    }
  }
  return { status: 'unknown', campaignId: null, leadsGenerated: entry.leadsGenerated }
}
