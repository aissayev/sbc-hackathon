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
import type { IncomingMessage } from '../../channels/types.ts'
import { handleOwnerCommand, sendOwnerReply } from './commands.ts'
import { shortId } from './format.ts'

export async function handleOwnerCallback(
  token: string,
  chatId: string,
  data: string,
): Promise<boolean> {
  if (data.startsWith('approve:')) return await handleApprove(token, chatId, data.slice('approve:'.length))
  if (data.startsWith('reject:')) return await handleReject(token, chatId, data.slice('reject:'.length))
  if (data.startsWith('view_esc:')) return await handleViewEsc(token, chatId, data.slice('view_esc:'.length))
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
