// Campaigns view for the cockpit. Pulls from sandbox marketing tools
// and overlays our local strategy plan (data/campaigns/plans.json).
//
// Read-only + adjust: the agent may have launched stuff in the sandbox;
// we surface it. Owner can pause/resume/adjust through our action API
// which forwards to the sandbox `marketing_adjust_campaign`.

import { tryCallSandboxTool } from '../lib/sandbox-mcp.ts'
import { loadCampaignsFile } from './campaigns.ts'

export interface CampaignSummary {
  id: string
  name?: string
  channel?: string
  status?: 'draft' | 'queued' | 'running' | 'paused' | 'closed' | 'unknown'
  budgetUsd?: number
  spendUsd?: number
  leads?: number
  impressions?: number
  clicks?: number
  conversions?: number
  startedAt?: number
  notes?: string
}

export interface CampaignsCockpit {
  monthlyBudgetUsd: number
  targetEffectUsd: number
  spendUsd: number
  remainingUsd: number
  leadsTotal: number
  campaigns: CampaignSummary[]
  recommendedStrategyId?: string
  errors: string[]
}

interface RawCampaign {
  id?: string
  campaignId?: string
  name?: string
  channel?: string
  status?: string
  budgetUsd?: number
  budget_usd?: number
  spendUsd?: number
  spend_usd?: number
  leads?: number
  impressions?: number
  clicks?: number
  conversions?: number
  startedAt?: string | number
  started_at?: string | number
  createdAt?: string | number
  notes?: string
}

interface BudgetShape {
  monthlyBudgetUsd?: number
  targetEffectUsd?: number
}

function toEpoch(v: string | number | undefined): number | undefined {
  if (v == null) return undefined
  if (typeof v === 'number') return v < 1e12 ? v * 1000 : v
  const n = Date.parse(v)
  return Number.isFinite(n) ? n : undefined
}

function normaliseStatus(s?: string): CampaignSummary['status'] {
  if (!s) return 'unknown'
  const lower = s.toLowerCase()
  if (['draft', 'queued', 'running', 'paused', 'closed'].includes(lower)) {
    return lower as CampaignSummary['status']
  }
  if (lower === 'live' || lower === 'active') return 'running'
  if (lower === 'ended' || lower === 'finished') return 'closed'
  return 'unknown'
}

export async function getCampaignsCockpit(): Promise<CampaignsCockpit> {
  const errors: string[] = []
  const [budget, metrics] = await Promise.all([
    tryCallSandboxTool<BudgetShape>('marketing_get_budget', {})
      .catch(() => null),
    tryCallSandboxTool<{ campaigns?: RawCampaign[] } | RawCampaign[]>('marketing_get_campaign_metrics', {})
      .catch(() => null),
  ])
  if (!budget) errors.push('budget')
  if (!metrics) errors.push('metrics')

  let plan: Awaited<ReturnType<typeof loadCampaignsFile>> | null = null
  try { plan = loadCampaignsFile() } catch { plan = null }

  const monthlyBudgetUsd = budget?.monthlyBudgetUsd ?? plan?.constraint.monthlyBudgetUsd ?? 500
  const targetEffectUsd = budget?.targetEffectUsd ?? plan?.constraint.targetEffectUsd ?? 5000

  const raw = (Array.isArray(metrics) ? metrics : (metrics?.campaigns ?? [])) as RawCampaign[]
  const campaigns: CampaignSummary[] = raw.map((c) => ({
    id: String(c.id ?? c.campaignId ?? `cmp_${Math.random().toString(36).slice(2, 8)}`),
    name: c.name,
    channel: c.channel,
    status: normaliseStatus(c.status),
    budgetUsd: c.budgetUsd ?? c.budget_usd,
    spendUsd: c.spendUsd ?? c.spend_usd ?? 0,
    leads: c.leads ?? 0,
    impressions: c.impressions,
    clicks: c.clicks,
    conversions: c.conversions,
    startedAt: toEpoch(c.startedAt ?? c.started_at ?? c.createdAt),
    notes: c.notes,
  }))

  const spendUsd = campaigns.reduce((acc, c) => acc + (c.spendUsd ?? 0), 0)
  const leadsTotal = campaigns.reduce((acc, c) => acc + (c.leads ?? 0), 0)

  return {
    monthlyBudgetUsd,
    targetEffectUsd,
    spendUsd,
    remainingUsd: Math.max(0, monthlyBudgetUsd - spendUsd),
    leadsTotal,
    campaigns,
    recommendedStrategyId: plan?.recommendation.primary,
    errors,
  }
}

export interface CampaignDetail extends CampaignSummary {
  source: 'sandbox' | 'local-plan'
  thesis?: string
  rolloutMonths?: Record<string, { phase: string; spendUsd?: number; expectedOutcomes?: Record<string, number | string> }>
}

export async function getCampaignDetail(id: string): Promise<CampaignDetail | null> {
  // Sandbox first — that's the live state if any campaign is actually running.
  const cockpit = await getCampaignsCockpit()
  const fromSandbox = cockpit.campaigns.find((c) => c.id === id)
  if (fromSandbox) return { ...fromSandbox, source: 'sandbox' }

  // Otherwise look up the planned strategy in our local plan.
  let plan: Awaited<ReturnType<typeof loadCampaignsFile>> | null = null
  try { plan = loadCampaignsFile() } catch {}
  const strategy = plan?.strategies.find((s) => s.id === id)
  if (!strategy) return null
  return {
    id: strategy.id,
    name: strategy.name,
    channel: strategy.primaryChannel,
    status: 'draft',
    budgetUsd: strategy.fullBudgetUsd,
    spendUsd: 0,
    leads: 0,
    notes: strategy.alternativeNote,
    thesis: strategy.thesis,
    rolloutMonths: {
      ...(strategy.monthlyRollout.month1 ? { month1: strategy.monthlyRollout.month1 } : {}),
      ...(strategy.monthlyRollout.month2 ? { month2: strategy.monthlyRollout.month2 } : {}),
      ...(strategy.monthlyRollout.month3 ? { month3: strategy.monthlyRollout.month3 } : {}),
      ...(strategy.monthlyRollout.month6 ? { month6: strategy.monthlyRollout.month6 } : {}),
    },
    source: 'local-plan',
  }
}

export async function adjustCampaign(id: string, action: 'pause' | 'resume' | 'adjust', payload?: Record<string, unknown>): Promise<{ ok: boolean; message: string; raw?: unknown }> {
  const args: Record<string, unknown> = { campaignId: id, action, ...payload }
  const raw = await tryCallSandboxTool('marketing_adjust_campaign', args)
  if (raw == null) return { ok: false, message: `Sandbox marketing_adjust_campaign(${action}) failed.` }
  return { ok: true, message: `Sent ${action} to sandbox.`, raw }
}
