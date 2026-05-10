// Owner-bot inline-keyboard callback router.
//
// Callbacks bypass `claude -p` — they call deterministic orchestration
// (`approveDraftAndPromote` / `rejectDraft`) so the "press a button → cake
// is ordered" path doesn't depend on LLM reasoning.
//
// Recognized data shapes:
//   approve:<order_id>   → promote draft → sandbox Square + Kitchen
//   reject:<order_id>    → mark rejected, store default reason
//   view_esc:<esc_id>    → invite owner to type a reply
//   /<command>           → re-route into the slash-command handler (so the
//                          "📋 Orders" button on /today re-uses /orders)
//
// Returns true if handled here. Returns false to fall through to the agent
// (server.ts onCallback uses this signal to decide whether to spawn claude -p).

import { sendTelegram } from '../../channels/telegram.ts'
import { approveDraftAndPromote, rejectDraft } from '../../domain/order-orchestration.ts'
import { tryCallSandboxTool } from '../../lib/sandbox-mcp.ts'
import {
  loadCampaignsFile,
  loadCampaignRunState,
  statusForPlan,
} from '../../domain/campaigns.ts'
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { IncomingMessage } from '../../channels/types.ts'
import { handleOwnerCommand, sendOwnerReply, renderCampaignDetail } from './commands.ts'
import { shortId } from './format.ts'

export async function handleOwnerCallback(
  token: string,
  chatId: string,
  data: string,
): Promise<boolean> {
  if (data.startsWith('approve:')) return await handleApprove(token, chatId, data.slice('approve:'.length))
  if (data.startsWith('reject:')) return await handleReject(token, chatId, data.slice('reject:'.length))
  if (data.startsWith('view_esc:')) return await handleViewEsc(token, chatId, data.slice('view_esc:'.length))
  if (data.startsWith('view_campaign:'))
    return await handleViewCampaign(token, chatId, data.slice('view_campaign:'.length))
  if (data.startsWith('launch_campaign:'))
    return await handleLaunchCampaign(token, chatId, data.slice('launch_campaign:'.length))
  if (data.startsWith('metrics_campaign:'))
    return await handleMetricsCampaign(token, chatId, data.slice('metrics_campaign:'.length))
  if (data.startsWith('/')) return await handleSlashRedispatch(chatId, data)
  return false
}

async function handleApprove(token: string, chatId: string, orderId: string): Promise<true> {
  const r = await approveDraftAndPromote(orderId)
  if (r.ok) {
    const lines: string[] = [`✓ ${shortId(orderId)} approved & promoted`]
    if (r.square_order_id) lines.push(`   Square: ${shortId(r.square_order_id)}`)
    if (r.kitchen_ticket_id) lines.push(`   Kitchen: ${shortId(r.kitchen_ticket_id)}`)
    await sendTelegram(token, chatId, lines.join('\n'))
  } else {
    await sendTelegram(
      token,
      chatId,
      `✗ ${shortId(orderId)} approval failed at ${r.stage ?? 'unknown'}: ${r.error ?? 'unknown error'}`,
    )
  }
  return true
}

async function handleReject(token: string, chatId: string, orderId: string): Promise<true> {
  const r = await rejectDraft(orderId, 'rejected by owner')
  await sendTelegram(
    token,
    chatId,
    r.ok ? `✗ ${shortId(orderId)} rejected` : `Couldn't reject ${shortId(orderId)}: ${r.error ?? 'unknown'}`,
  )
  return true
}

async function handleViewEsc(token: string, chatId: string, escId: string): Promise<true> {
  await sendTelegram(token, chatId, `Escalation ${shortId(escId)} — type your reply, I'll relay it.`)
  return true
}

async function handleSlashRedispatch(chatId: string, data: string): Promise<boolean> {
  const fakeMsg: IncomingMessage = {
    channel: 'telegram',
    threadId: chatId,
    senderId: chatId,
    text: data,
    timestamp: Date.now(),
    raw: { callback: data },
    roleHint: 'owner',
  }
  const reply = handleOwnerCommand(fakeMsg)
  if (!reply) return false
  await sendOwnerReply(chatId, reply)
  return true
}

async function handleViewCampaign(token: string, chatId: string, planId: string): Promise<true> {
  const reply = renderCampaignDetail(planId)
  await sendTelegram(token, chatId, reply.text, reply.keyboard)
  return true
}

/**
 * Owner approves + launches a planned campaign from the Telegram cockpit.
 * Calls `marketing_create_campaign` then `marketing_launch_simulated_campaign`,
 * persists the campaignId into data/campaigns/.state/last-run.json so
 * subsequent /campaigns reflects the live status.
 *
 * NOTE on sandbox-side approval gates: we do NOT bypass them. The sandbox's
 * `marketing_launch_simulated_campaign` accepts an `approvalNote` field —
 * we tag it with the operator's chat id so the audit trail traces back to
 * a real human action.
 */
async function handleLaunchCampaign(token: string, chatId: string, planId: string): Promise<true> {
  let plans
  try {
    plans = loadCampaignsFile()
  } catch (err) {
    await sendTelegram(token, chatId, `Couldn't read plan: ${(err as Error).message}`)
    return true
  }
  const plan = plans.campaigns.find((c) => c.id === planId)
  if (!plan) {
    await sendTelegram(token, chatId, `No campaign with id "${planId}".`)
    return true
  }
  if (plan.budgetUsd === 0) {
    await sendTelegram(token, chatId, `"${plan.name}" is organic ($0) — no ads to launch.`)
    return true
  }

  await sendTelegram(token, chatId, `Launching "${plan.name}" ($${plan.budgetUsd})…`)

  const audienceText = plan.icp.length > 1 ? plan.icp.slice(0, 3).join(' · ') : (plan.icp[0] ?? '')
  const created = await tryCallSandboxTool<{
    campaign?: { id?: string; campaignId?: string }
    campaignId?: string
    id?: string
  }>('marketing_create_campaign', {
    name: plan.name,
    channel: plan.channel,
    objective: plan.objective,
    budgetUsd: plan.budgetUsd,
    targetAudience: audienceText,
    offer: plan.offer,
    landingPath: plan.landingPath,
    hypothesisLine: `${plan.lever}: ${plan.creativeStrategy}`,
  })

  const campaignId =
    created?.campaignId ??
    created?.id ??
    created?.campaign?.id ??
    created?.campaign?.campaignId ??
    null
  if (!campaignId) {
    await sendTelegram(
      token,
      chatId,
      `✗ Failed to create "${plan.name}" — sandbox didn't return a campaignId.`,
    )
    return true
  }

  const launch = await tryCallSandboxTool('marketing_launch_simulated_campaign', {
    campaignId,
    approvalNote: `Owner approved via Telegram /campaigns (chat=${chatId})`,
  })

  if (!launch) {
    await sendTelegram(
      token,
      chatId,
      `⚠ "${plan.name}" created (${shortId(campaignId)}) but launch returned no result. Check sandbox state.`,
    )
    return true
  }

  // Generate + route a few simulated leads so the routing surface is exercised
  const leads = (await tryCallSandboxTool<
    { leads?: Array<{ id?: string; leadId?: string }> } | Array<{ id?: string; leadId?: string }>
  >('marketing_generate_leads', { campaignId })) as
    | { leads?: Array<{ id?: string; leadId?: string }> }
    | Array<{ id?: string; leadId?: string }>
    | null
  const leadList = Array.isArray(leads) ? leads : (leads?.leads ?? [])
  if (leadList && leadList.length > 0) {
    for (const [i, lead] of leadList.slice(0, 3).entries()) {
      const leadId = lead.id ?? lead.leadId
      if (!leadId) continue
      const target = i === 0 ? 'whatsapp' : i === 1 ? 'instagram' : 'website'
      await tryCallSandboxTool('marketing_route_lead', {
        leadId,
        routeTo: target,
        reason: `Routed to ${target} from owner-approved /campaigns launch`,
      })
    }
  }

  // Persist into the run-state file so /campaigns sees launched status
  upsertCampaignRunState(planId, campaignId, leadList?.length ?? 0)

  await sendTelegram(
    token,
    chatId,
    [
      `✓ "${plan.name}" launched`,
      `  Sandbox: ${shortId(campaignId)}`,
      `  Leads simulated: ${leadList?.length ?? 0}`,
      `  Tap /campaigns to view.`,
    ].join('\n'),
  )
  return true
}

async function handleMetricsCampaign(token: string, chatId: string, planId: string): Promise<true> {
  const state = loadCampaignRunState()
  const st = statusForPlan(planId, state)
  if (!st.campaignId) {
    await sendTelegram(token, chatId, `"${planId}" is not launched yet — open it from /campaigns to approve.`)
    return true
  }
  const metrics = await tryCallSandboxTool<Record<string, unknown>>('marketing_get_campaign_metrics', {
    campaignId: st.campaignId,
  })
  if (!metrics) {
    await sendTelegram(token, chatId, `No metrics returned for ${shortId(st.campaignId)}.`)
    return true
  }
  const lines = Object.entries(metrics)
    .slice(0, 12)
    .map(([k, v]) => `  ${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
  await sendTelegram(token, chatId, [`Metrics for ${shortId(st.campaignId)}:`, ...lines].join('\n'))
  return true
}

function upsertCampaignRunState(planId: string, campaignId: string, leadsGenerated: number): void {
  const dir = resolve('data/campaigns/.state')
  mkdirSync(dir, { recursive: true })
  const path = resolve(dir, 'last-run.json')
  let current: { ranAt: string; launched: Array<{ planId: string; campaignId: string | null; leadsGenerated: number }> } = {
    ranAt: new Date().toISOString(),
    launched: [],
  }
  if (existsSync(path)) {
    try {
      current = JSON.parse(readFileSync(path, 'utf8'))
    } catch {
      // fall through with defaults
    }
  }
  const idx = current.launched.findIndex((l) => l.planId === planId)
  const entry = { planId, campaignId, leadsGenerated }
  if (idx >= 0) current.launched[idx] = entry
  else current.launched.push(entry)
  current.ranAt = new Date().toISOString()
  writeFileSync(path, JSON.stringify(current, null, 2))
}
