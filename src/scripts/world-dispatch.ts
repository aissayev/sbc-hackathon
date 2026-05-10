// Shared dispatch table for world-events. Used by world-run.ts (full scenario
// loop) and world-tick.ts (single event for cron). Keeps the (channel, type)
// → handler map in one place so the taxonomy stays in sync.
//
// See docs/04-test/WORLD-SCENARIOS.md for the full taxonomy + rationale.

import { invokeAgent, recordRun } from '../agent/invoke.ts'
import { pickRole } from '../agent/router.ts'
import { whatsappAdapter } from '../channels/whatsapp.ts'
import { instagramAdapter } from '../channels/instagram/index.ts'
import { webAdapter } from '../channels/web.ts'
import { telegramAdapter } from '../channels/telegram.ts'
import { tryCallSandboxTool } from '../lib/sandbox-mcp.ts'
import type { ChannelAdapter, IncomingMessage, AgentRole } from '../channels/types.ts'

export interface WorldEvent {
  id: string
  scenarioId: string
  minute: number
  channel: string
  type: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  payload: Record<string, unknown>
  deliveredAt: string
}

export interface DispatchResult {
  handled: boolean
  agentCalls: number
  costUsd: number
  reply?: string
  toolCount?: number
}

const adapters: Record<string, ChannelAdapter> = {
  web: webAdapter,
  whatsapp: whatsappAdapter,
  instagram: instagramAdapter,
  telegram: telegramAdapter,
}

async function runAgentTurn(
  channel: 'whatsapp' | 'instagram' | 'web',
  threadId: string,
  text: string,
  evt: WorldEvent,
  mcpConfigPath: string,
  roleOverride?: AgentRole,
): Promise<DispatchResult> {
  const msg: IncomingMessage = {
    channel,
    threadId,
    senderId: threadId,
    text,
    timestamp: new Date(evt.deliveredAt).getTime(),
    raw: evt,
    roleHint: roleOverride,
  }
  const role = pickRole(msg)
  const run = await invokeAgent({ role, msg, mcpConfigPath })
  recordRun(threadId, run)
  if (run.reply && adapters[channel]) {
    await adapters[channel].send(threadId, run.reply)
  }
  return {
    handled: true,
    agentCalls: 1,
    costUsd: run.cost_usd ?? 0,
    reply: run.reply,
    toolCount: run.tool_calls.length,
  }
}

export async function dispatchWorldEvent(
  evt: WorldEvent,
  mcpConfigPath: string,
): Promise<DispatchResult> {
  // ─── WhatsApp ────────────────────────────────────────────────────────────
  if (evt.channel === 'whatsapp' && (evt.type === 'inbound_message' || evt.type === 'complaint')) {
    const p = evt.payload as { from: string; message: string }
    return runAgentTurn('whatsapp', p.from, p.message, evt, mcpConfigPath)
  }
  // ─── Instagram ───────────────────────────────────────────────────────────
  if (evt.channel === 'instagram' && (evt.type === 'inbound_dm' || evt.type === 'inbound_message' || evt.type === 'dm_order_intent')) {
    const p = evt.payload as { threadId?: string; from?: string; handle?: string; message?: string; intent?: string }
    const tid = p.threadId ?? p.from ?? p.handle ?? `ig_${evt.id}`
    const text = p.message ?? p.intent ?? '(order intent signal — no body)'
    return runAgentTurn('instagram', tid, text, evt, mcpConfigPath)
  }
  if (evt.channel === 'instagram' && evt.type === 'comment') {
    const p = evt.payload as { handle: string; post: string; comment: string; commentId?: string }
    const tid = `ig_comment_${p.commentId ?? evt.id}`
    const synthetic = `Customer @${p.handle} commented on post "${p.post}": "${p.comment}". Decide whether to reply publicly via instagram_reply_to_comment, upgrade to DM via instagram_send_dm, or both.`
    return runAgentTurn('instagram', tid, synthetic, evt, mcpConfigPath)
  }
  // ─── Marketing ───────────────────────────────────────────────────────────
  if (evt.channel === 'marketing' && evt.type === 'campaign_lead_spike') {
    const p = evt.payload as { campaignHint: string; leads: number; budgetPressureUsd: number }
    for (let i = 0; i < Math.min(p.leads, 5); i++) {
      await tryCallSandboxTool('marketing_route_lead', {
        leadHint: p.campaignHint,
        source: 'world_event',
      })
    }
    await tryCallSandboxTool('marketing_report_to_owner', {
      summary: `${p.leads} leads on ${p.campaignHint}; $${p.budgetPressureUsd} budget pressure flagged at minute ${evt.minute}.`,
    })
    return { handled: true, agentCalls: 0, costUsd: 0 }
  }
  if (evt.channel === 'marketing' && evt.type === 'local_search_surge') {
    const p = evt.payload as { query: string; leads: number; expectedConversionWindowMinutes: number }
    await tryCallSandboxTool('marketing_get_budget', {})
    await tryCallSandboxTool('marketing_report_to_owner', {
      summary: `Local-search surge on "${p.query}": ${p.leads} leads, ${p.expectedConversionWindowMinutes}min conversion window.`,
    })
    return { handled: true, agentCalls: 0, costUsd: 0 }
  }
  // ─── Square (POS) ────────────────────────────────────────────────────────
  if (evt.channel === 'square' && evt.type === 'walk_in_order') {
    const p = evt.payload as { source: string; items: Array<{ variationId: string; quantity: number }> }
    for (const item of p.items) {
      await tryCallSandboxTool('kitchen_create_ticket', {
        productId: item.variationId,
        quantity: item.quantity,
        source: p.source,
        notes: `world_event:${evt.id} (walk-in)`,
      })
    }
    return { handled: true, agentCalls: 0, costUsd: 0 }
  }
  // ─── Google Business ─────────────────────────────────────────────────────
  if ((evt.channel === 'gbusiness' || evt.channel === 'google_business') && evt.type === 'review') {
    const p = evt.payload as { reviewId?: string; rating: number; text?: string; content?: string }
    const reviewText = p.text ?? p.content ?? ''
    const tone = p.rating >= 4
      ? `Thank you so much${reviewText ? ', and we love hearing this' : ''} — see you next time at HappyCake.`
      : p.rating === 3
      ? `Thank you for the honest feedback. We'd love a chance to make it right — please WhatsApp us so Askhat can follow up directly.`
      : `We're truly sorry — that's not the experience we want to deliver. Askhat will reach out personally; please share your order details via WhatsApp so we can fix this.`
    if (p.reviewId) {
      await tryCallSandboxTool('gb_simulate_reply', { reviewId: p.reviewId, reply: tone })
    }
    return { handled: true, agentCalls: 0, costUsd: 0 }
  }
  // ─── Kitchen ─────────────────────────────────────────────────────────────
  if (evt.channel === 'kitchen' && evt.type === 'capacity_pressure') {
    const p = evt.payload as { remainingCapacityMinutes: number; customCakeSlotsLeft: number; warning?: string }
    await tryCallSandboxTool('kitchen_get_capacity', {})
    await tryCallSandboxTool('marketing_report_to_owner', {
      summary: `Kitchen capacity pressure at minute ${evt.minute}: ${p.remainingCapacityMinutes}min remaining, ${p.customCakeSlotsLeft} custom slot(s). ${p.warning ?? ''}`.trim(),
    })
    return { handled: true, agentCalls: 0, costUsd: 0 }
  }
  if (evt.channel === 'kitchen' && evt.type === 'stockout_risk') {
    const p = evt.payload as { productId: string; remainingUnits: number; action?: string }
    await tryCallSandboxTool('marketing_adjust_campaign', {
      productId: p.productId,
      action: 'throttle',
      reason: `stockout_risk:${p.remainingUnits}_units_left`,
    })
    await tryCallSandboxTool('marketing_report_to_owner', {
      summary: `Stockout risk on ${p.productId}: ${p.remainingUnits} units left. Action: ${p.action ?? 'throttle/substitute'}.`,
    })
    return { handled: true, agentCalls: 0, costUsd: 0 }
  }
  if (evt.channel === 'kitchen' && evt.type === 'ticket_ready') {
    return { handled: true, agentCalls: 0, costUsd: 0 }
  }

  return { handled: false, agentCalls: 0, costUsd: 0 }
}
