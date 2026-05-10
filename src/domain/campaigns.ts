// Read-only loader for the marketing strategy plan (data/campaigns/plans.json).
//
// Schema v4: $500/mo deploys to ONE strategy at a time. Each strategy is a
// complete $500 deployment with its own 3- and 6-month rollout. The owner
// picks ONE in Telegram /campaigns and that one launches.
//
// Two callers:
//   1. src/scripts/marketing-run.ts — launches the chosen strategy via
//      marketing_create_campaign + marketing_launch_simulated_campaign.
//   2. src/bots/owner/commands.ts — surfaces the strategies in Telegram via
//      /campaigns so the operator picks one and approves.
//
// Status comes from data/campaigns/.state/last-run.json (written after a
// strategy is launched, either via the CLI script or the Telegram approve
// callback).
//
// Pure loader — no MCP calls here.

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

export interface MonthlyRolloutPhase {
  phase: string
  spendUsd?: number
  subAllocation?: Record<string, number>
  creativeStrategy?: string
  expectedOutcomes?: Record<string, number | string>
  killScaleRules?: string
}

export interface CampaignStrategy {
  id: string
  name: string
  recommended: boolean
  alternativeNote?: string
  fullBudgetUsd: number
  primaryChannel: 'instagram' | 'google_local' | 'whatsapp' | 'website' | 'mixed'
  secondaryChannel?: 'instagram' | 'google_local' | 'whatsapp' | 'website' | 'mixed'
  anchorSku: string
  supportingSkus: string[]
  icp: string[]
  thesis: string
  monthlyRollout: {
    month1?: MonthlyRolloutPhase
    month2?: MonthlyRolloutPhase
    month3?: MonthlyRolloutPhase
    month6?: MonthlyRolloutPhase
  }
  killThresholdsBlended: string
  scaleThresholdsBlended: string
  ownerApprovalRequired: boolean
}

export interface OrganicTrack {
  id: string
  name: string
  budgetUsd: 0
  effortRequired: string
  purpose: string
  tracks: Record<string, { deliverable: string; expectedOutcome: string }>
  monthlyTimeline: Record<string, string>
}

export interface CampaignsFile {
  version: number
  lastReviewed: string
  liveMargins: Record<string, number>
  constraint: {
    monthlyBudgetUsd: number
    targetEffectUsd: number
    challenge: string
    deploymentRule: string
  }
  recommendation: {
    primary: string
    rationale: string
  }
  strategies: CampaignStrategy[]
  alwaysOnOrganic: OrganicTrack
}

export interface CampaignRunState {
  ranAt: string
  chosenStrategyId?: string
  launched: Array<{
    strategyId: string
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

export type StrategyStatus = 'planned' | 'chosen' | 'launched' | 'unknown'

export function statusForStrategy(
  strategyId: string,
  state: CampaignRunState | null,
): {
  status: StrategyStatus
  campaignId: string | null
  leadsGenerated: number
} {
  if (!state) return { status: 'planned', campaignId: null, leadsGenerated: 0 }
  const entry = state.launched.find((l) => l.strategyId === strategyId)
  if (entry?.campaignId) {
    return {
      status: 'launched',
      campaignId: entry.campaignId,
      leadsGenerated: entry.leadsGenerated,
    }
  }
  if (state.chosenStrategyId === strategyId) {
    return { status: 'chosen', campaignId: null, leadsGenerated: 0 }
  }
  return { status: 'planned', campaignId: null, leadsGenerated: 0 }
}
