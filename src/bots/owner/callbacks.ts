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
import { approveRefund, denyRefund } from '../../domain/refunds.ts'
import { replyToInboxThread } from '../../domain/inbox.ts'
import { tryCallSandboxTool } from '../../lib/sandbox-mcp.ts'
import {
  loadCampaignsFile,
  loadCampaignRunState,
  statusForStrategy,
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
  if (data.startsWith('refund_approve:'))
    return await handleRefundApprove(token, chatId, data.slice('refund_approve:'.length))
  if (data.startsWith('refund_deny:'))
    return await handleRefundDeny(token, chatId, data.slice('refund_deny:'.length))
  if (data.startsWith('reply_wa:'))
    return await handleReplyPrompt(token, chatId, 'whatsapp', data.slice('reply_wa:'.length))
  if (data.startsWith('reply_ig:'))
    return await handleReplyPrompt(token, chatId, 'instagram', data.slice('reply_ig:'.length))
  if (data.startsWith('reply_web:'))
    return await handleReplyPrompt(token, chatId, 'web', data.slice('reply_web:'.length))
  if (data.startsWith('reply_review:')) {
    // Reviews use the engagement-inbox drafter (claude -p) for tone-on-brand
    // replies — point the operator there instead of falling through to the
    // agent (which would treat the callback data as a free-text message).
    await sendTelegram(token, chatId, '⭐ Open /reviews — drafted replies live there with 1-tap send.')
    return true
  }
  if (data.startsWith('view_esc:')) return await handleViewEsc(token, chatId, data.slice('view_esc:'.length))
  if (data.startsWith('view_campaign:'))
    return await handleViewCampaign(token, chatId, data.slice('view_campaign:'.length))
  if (data === 'view_organic') return await handleViewCampaign(token, chatId, 'organic')
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

// ─── Refund flow ────────────────────────────────────────────────────────
//
// Approve is one-tap: directly calls approveRefund (which talks to Square,
// flips local state, and pushes a customer notification). Deny needs a
// reason from the owner, so we register a "pending denial" against this
// chat id and the next text message from that chat is consumed by
// `tryHandlePendingRefundDenial` (called from server.ts onMessage BEFORE
// it routes to the agent). 10-minute TTL — if the owner walks away, the
// pending state is forgotten and they need to tap Deny again.

interface PendingDenial {
  refundId: string
  expiresAt: number
}

const PENDING_DENIAL_TTL_MS = 10 * 60 * 1000
const pendingDenials = new Map<string, PendingDenial>()

async function handleRefundApprove(
  token: string,
  chatId: string,
  refundId: string,
): Promise<true> {
  const r = await approveRefund(refundId)
  if (r.ok) {
    const lines: string[] = [`✓ refund ${shortId(refundId)} approved`]
    if (r.square_updated) lines.push('   Square: order CANCELED')
    else lines.push('   Square: skipped (no linked order)')
    if (r.customer_notified) lines.push('   Customer: notified on original channel')
    else lines.push("   Customer: notification skipped (channel didn't accept)")
    await sendTelegram(token, chatId, lines.join('\n'))
  } else {
    await sendTelegram(
      token,
      chatId,
      `✗ refund ${shortId(refundId)} approval failed: ${r.error ?? 'unknown'}`,
    )
  }
  return true
}

async function handleRefundDeny(token: string, chatId: string, refundId: string): Promise<true> {
  pendingDenials.set(chatId, { refundId, expiresAt: Date.now() + PENDING_DENIAL_TTL_MS })
  await sendTelegram(
    token,
    chatId,
    [
      `Denying refund ${shortId(refundId)}.`,
      'Reply to this chat with the reason — I\'ll send it to the customer verbatim.',
      '(10 min timeout. Tap Deny again to restart.)',
    ].join('\n'),
  )
  return true
}

/**
 * Called by server.ts BEFORE the agent path. Returns true (and processes
 * the denial) if the owner has a pending refund-denial against this chat
 * and just sent a free-text message — that text becomes the customer-
 * facing reason. Returns false otherwise (agent / slash flow continues).
 */
export async function tryHandlePendingRefundDenial(
  chatId: string,
  reason: string,
): Promise<boolean> {
  const pending = pendingDenials.get(chatId)
  if (!pending) return false
  if (Date.now() > pending.expiresAt) {
    pendingDenials.delete(chatId)
    return false
  }
  pendingDenials.delete(chatId)
  const token = (await import('../../config.ts')).config.telegram.owner.token
  if (!token) return true // can't send anything; consume the message anyway
  const r = await denyRefund(pending.refundId, reason.trim())
  if (r.ok) {
    const lines: string[] = [`✗ refund ${shortId(pending.refundId)} denied`]
    if (r.customer_notified) lines.push('   Customer: notified on original channel')
    else lines.push("   Customer: notification skipped (channel didn't accept)")
    await sendTelegram(token, chatId, lines.join('\n'))
  } else {
    await sendTelegram(
      token,
      chatId,
      `✗ refund ${shortId(pending.refundId)} denial failed: ${r.error ?? 'unknown'}`,
    )
  }
  return true
}

// ─── Inbox reply flow (TG chat → WA / IG / web) ──────────────────────────
//
// Tap "💬 Reply" on a thread row from /inbox → we register a pending
// reply against this chat id. The next free-text message becomes the
// reply, sent through the channel adapter (dual-path on WA, sandbox
// MCP on IG, local-history append on web). Mirrors the refund-denial
// pattern: 10-min TTL, in-memory Map. Walk away → forgotten, tap Reply
// again to start over.

interface PendingReply {
  channel: 'whatsapp' | 'instagram' | 'web'
  threadId: string
  expiresAt: number
}

const PENDING_REPLY_TTL_MS = 10 * 60 * 1000
const pendingReplies = new Map<string, PendingReply>()

async function handleReplyPrompt(
  token: string,
  chatId: string,
  channel: 'whatsapp' | 'instagram' | 'web',
  threadId: string,
): Promise<true> {
  pendingReplies.set(chatId, {
    channel,
    threadId,
    expiresAt: Date.now() + PENDING_REPLY_TTL_MS,
  })
  const channelLabel =
    channel === 'whatsapp' ? 'WhatsApp' :
    channel === 'instagram' ? 'Instagram DM' :
    'website chat'
  await sendTelegram(
    token,
    chatId,
    [
      `📨 Replying to ${channelLabel} ${shortId(threadId)}`,
      'Type your message — I\'ll send it as soon as you hit enter.',
      '(10 min timeout. Tap Reply again to restart.)',
    ].join('\n'),
  )
  return true
}

/**
 * Called by server.ts BEFORE the agent / slash-command paths. Returns
 * true if the owner has a pending inbox reply against this chat and the
 * incoming free-text was just consumed as the reply body. Returns false
 * otherwise so the normal flow continues.
 */
export async function tryHandlePendingThreadReply(
  chatId: string,
  text: string,
): Promise<boolean> {
  const pending = pendingReplies.get(chatId)
  if (!pending) return false
  if (Date.now() > pending.expiresAt) {
    pendingReplies.delete(chatId)
    return false
  }
  const trimmed = text.trim()
  // Bail-out: any slash command cancels the pending reply and falls back to
  // the slash-command / agent path. /cancel is the explicit form; /today,
  // /orders, etc. all also drop the pending state so the operator isn't
  // trapped in "reply mode" because they tapped Reply by mistake.
  if (trimmed.startsWith('/')) {
    pendingReplies.delete(chatId)
    const token = (await import('../../config.ts')).config.telegram.owner.token
    if (token && trimmed.toLowerCase() === '/cancel') {
      await sendTelegram(token, chatId, `↩ canceled — reply to ${shortId(pending.threadId)} not sent.`)
      return true  // /cancel consumed; don't pass to slash router
    }
    return false  // other slash commands continue down the normal path
  }
  pendingReplies.delete(chatId)
  const token = (await import('../../config.ts')).config.telegram.owner.token
  if (!token) return true  // can't acknowledge but consume the message anyway

  if (!trimmed) {
    await sendTelegram(token, chatId, '✗ Empty reply — nothing sent. Tap Reply again to retry.')
    return true
  }

  const r = await replyToInboxThread(pending.channel, pending.threadId, trimmed, 'tg_chat', chatId)
  if (r.ok) {
    const channelEmoji =
      pending.channel === 'whatsapp' ? '📱' :
      pending.channel === 'instagram' ? '📷' :
      '🌐'
    await sendTelegram(
      token,
      chatId,
      `${channelEmoji} sent → ${shortId(pending.threadId)}`,
    )
  } else {
    await sendTelegram(
      token,
      chatId,
      `✗ couldn't send to ${pending.channel} ${shortId(pending.threadId)}: ${r.error ?? 'unknown'}`,
    )
  }
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
async function handleLaunchCampaign(token: string, chatId: string, strategyId: string): Promise<true> {
  let plan
  try {
    plan = loadCampaignsFile()
  } catch (err) {
    await sendTelegram(token, chatId, `Couldn't read plan: ${(err as Error).message}`)
    return true
  }
  const strategy = plan.strategies.find((s) => s.id === strategyId)
  if (!strategy) {
    await sendTelegram(token, chatId, `No strategy with id "${strategyId}".`)
    return true
  }
  if (strategy.fullBudgetUsd === 0) {
    await sendTelegram(token, chatId, `"${strategy.name}" is organic ($0) — runs in parallel, no ads to launch.`)
    return true
  }

  // Refuse to double-launch — operator should explicitly retire the live one
  // first if they want to switch (a future Telegram action; for now, warn).
  const state = loadCampaignRunState()
  const live = plan.strategies.find((s) => statusForStrategy(s.id, state).status === 'launched')
  if (live && live.id !== strategy.id) {
    await sendTelegram(
      token,
      chatId,
      `⚠ "${live.name}" is already live with the full $${live.fullBudgetUsd}. Single-strategy rule: only ONE strategy runs at a time.\n\nSwitching strategies on the same budget is a deliberate decision — re-run \`bun run marketing:run --strategy ${strategy.id}\` from the server if you want to override.`,
    )
    return true
  }

  await sendTelegram(
    token,
    chatId,
    `Launching "${strategy.name}" with the FULL $${strategy.fullBudgetUsd}/mo budget…`,
  )

  const audienceText = strategy.icp.length > 1
    ? strategy.icp.slice(0, 3).join(' · ')
    : (strategy.icp[0] ?? '')
  const m1 = strategy.monthlyRollout.month1
  const created = await tryCallSandboxTool<{
    campaign?: { id?: string; campaignId?: string }
    campaignId?: string
    id?: string
  }>('marketing_create_campaign', {
    name: strategy.name,
    channel: strategy.primaryChannel,
    objective: m1?.phase ?? 'lead_gen',
    budgetUsd: strategy.fullBudgetUsd,
    targetAudience: audienceText,
    offer: `Anchor: ${strategy.anchorSku}. ${strategy.thesis}`,
    landingPath: `/menu/${strategy.anchorSku}`,
    hypothesisLine: `Single-strategy deployment ($${strategy.fullBudgetUsd}/mo) — ${m1?.creativeStrategy ?? 'see plan'}`,
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
      `✗ Failed to create "${strategy.name}" — sandbox didn't return a campaignId.`,
    )
    return true
  }

  const launch = await tryCallSandboxTool('marketing_launch_simulated_campaign', {
    campaignId,
    approvalNote: `Owner approved via Telegram /campaigns (chat=${chatId}) — single-strategy launch`,
  })

  if (!launch) {
    await sendTelegram(
      token,
      chatId,
      `⚠ "${strategy.name}" created (${shortId(campaignId)}) but launch returned no result. Check sandbox state.`,
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
  upsertCampaignRunState(strategyId, campaignId, leadList?.length ?? 0)

  await sendTelegram(
    token,
    chatId,
    [
      `✓ "${strategy.name}" launched`,
      `  Full $${strategy.fullBudgetUsd}/mo deployed.`,
      `  Sandbox: ${shortId(campaignId)}`,
      `  Leads simulated: ${leadList?.length ?? 0}`,
      `  Tap /campaigns to view.`,
    ].join('\n'),
  )
  return true
}

async function handleMetricsCampaign(token: string, chatId: string, strategyId: string): Promise<true> {
  const state = loadCampaignRunState()
  const st = statusForStrategy(strategyId, state)
  if (!st.campaignId) {
    await sendTelegram(token, chatId, `"${strategyId}" is not launched yet — open it from /campaigns to approve.`)
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

function upsertCampaignRunState(strategyId: string, campaignId: string, leadsGenerated: number): void {
  const dir = resolve('data/campaigns/.state')
  mkdirSync(dir, { recursive: true })
  const path = resolve(dir, 'last-run.json')
  let current: {
    ranAt: string
    chosenStrategyId?: string
    launched: Array<{ strategyId: string; campaignId: string | null; leadsGenerated: number }>
  } = {
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
  const idx = current.launched.findIndex((l) => l.strategyId === strategyId)
  const entry = { strategyId, campaignId, leadsGenerated }
  if (idx >= 0) current.launched[idx] = entry
  else current.launched.push(entry)
  current.chosenStrategyId = strategyId
  current.ranAt = new Date().toISOString()
  writeFileSync(path, JSON.stringify(current, null, 2))
}
