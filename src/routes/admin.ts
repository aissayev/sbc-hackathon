// Owner admin API — powers /admin/* on the website.
//
// ⚠️ HACKATHON-MODE OPEN ACCESS:
// These routes are intentionally unauthenticated for the build window. The
// admin pages are owner-facing per the brief ("owner UI is Telegram only" is
// the agent constraint; the website's /admin/* is a Mini-App-style surface
// for the owner). For any public deploy, gate behind cookie auth or the
// X-Telegram-Init-Data header (Mini App pattern).

import { Hono } from 'hono'
import {
  dailyReport,
  listOrders,
  listEscalations,
  getOrderStatus,
} from '../domain/tools.ts'
import { approveDraftAndPromote, rejectDraft } from '../domain/order-orchestration.ts'
import {
  listInboxThreads,
  getInboxThread,
  replyToInboxThread,
} from '../domain/inbox.ts'
import {
  listChannelStatuses,
  getChannelStatus,
  registerChannelWebhook,
  sendTestInbound,
  simulateInbound,
  type ChannelId,
} from '../domain/channels.ts'
import {
  getCampaignsCockpit,
  getCampaignDetail,
  adjustCampaign,
} from '../domain/campaigns-cockpit.ts'
import {
  listApprovals,
  getApproval,
  approveApproval,
  rejectApproval,
  approvalCounts,
  type ApprovalStatus,
} from '../domain/approvals.ts'
import { recordAuditEvent, listAuditEvents, auditCounts } from '../domain/audit.ts'
import { listAdminLogs, type LogChannel } from '../domain/admin-logs.ts'
import { getCockpitSettings } from '../domain/settings.ts'
import {
  listCustomers,
  getCustomerById,
  listCustomerOrders,
  updateCustomerNotes,
  mergeCustomers,
} from '../domain/customers.ts'
import {
  listApplications,
  getApplication,
  applicationCounts,
  updateApplication,
  updateApplicationSchema,
  type ApplicationRole,
  type ApplicationStatus,
} from '../domain/applications.ts'
import {
  listCheckouts,
  getCheckout,
  checkoutCounts,
  type CheckoutStep,
  type CheckoutStatus,
} from '../domain/checkouts.ts'

export const adminRoutes = new Hono()

adminRoutes.get('/api/admin/today', (c) => c.json(dailyReport()))

adminRoutes.get('/api/admin/orders', (c) => {
  const status = c.req.query('status') ?? undefined
  return c.json({ orders: listOrders({ status }) })
})

adminRoutes.get('/api/admin/orders/:id', (c) => {
  const id = c.req.param('id')
  const status = getOrderStatus({ order_id: id }) as Record<string, unknown>
  if (status && 'ok' in status && status.ok === false) return c.json(status, 404)
  return c.json(status)
})

// ── CRM ────────────────────────────────────────────────────────────
//
// List + detail + notes-edit for the customers table. Mirrors the
// shape of the /customer Telegram command and adds the "browse all"
// path that Telegram can't easily do.

adminRoutes.get('/api/admin/customers', (c) => {
  const q = c.req.query('q')?.trim() || undefined
  const limitRaw = c.req.query('limit')
  const offsetRaw = c.req.query('offset')
  const limit = limitRaw ? Math.max(1, Math.min(200, parseInt(limitRaw, 10) || 50)) : 50
  const offset = offsetRaw ? Math.max(0, parseInt(offsetRaw, 10) || 0) : 0
  const { rows, total } = listCustomers({ q, limit, offset })
  return c.json({ customers: rows, total, limit, offset })
})

adminRoutes.get('/api/admin/customers/:id', (c) => {
  const id = c.req.param('id')
  const customer = getCustomerById(id)
  if (!customer) return c.json({ ok: false, reason: 'customer not found' }, 404)
  return c.json({ customer, recent_orders: listCustomerOrders(id, 50) })
})

adminRoutes.put('/api/admin/customers/:id/notes', async (c) => {
  const id = c.req.param('id')
  let body: { notes?: string | null } = {}
  try { body = (await c.req.json()) as { notes?: string | null } } catch {}
  const updated = updateCustomerNotes(id, body.notes ?? null)
  if (!updated) return c.json({ ok: false, reason: 'customer not found' }, 404)
  recordAuditEvent({
    action: 'customer_notes_update', targetId: id,
    result: (updated.notes ?? '').slice(0, 80),
    outcome: 'ok',
  })
  return c.json({ ok: true, customer: updated })
})

adminRoutes.post('/api/admin/customers/merge', async (c) => {
  let body: { source_id?: string; target_id?: string } = {}
  try { body = (await c.req.json()) as { source_id?: string; target_id?: string } } catch {}
  if (!body.source_id || !body.target_id) {
    return c.json({ ok: false, reason: 'source_id and target_id required' }, 400)
  }
  const result = mergeCustomers(body.source_id, body.target_id)
  recordAuditEvent({
    action: 'customer_merge', targetId: body.target_id,
    result: result.ok ? `merged source=${body.source_id} → target=${body.target_id}` : (result.reason ?? 'failed'),
    outcome: result.ok ? 'ok' : 'error',
  })
  return c.json(result, result.ok ? 200 : 400)
})

adminRoutes.get('/api/admin/escalations', (c) => {
  const status = c.req.query('status') ?? undefined
  return c.json({ escalations: listEscalations({ status }) })
})

// Combined feed of agent_invocations + audit_log, channel-filtered.
// Powers the /admin/logs Mini App page so the owner can see every WA +
// IG + web event without dropping to SQLite.
adminRoutes.get('/api/admin/logs', (c) => {
  const channelRaw = (c.req.query('channel') ?? 'all') as LogChannel | 'all'
  const sinceRaw = c.req.query('since')
  const limitRaw = c.req.query('limit')
  const since = sinceRaw ? Math.max(0, parseInt(sinceRaw, 10) || 0) : undefined
  const limit = limitRaw ? Math.max(1, Math.min(500, parseInt(limitRaw, 10) || 100)) : 100
  return c.json(listAdminLogs({ channel: channelRaw, since, limit }))
})

adminRoutes.post('/api/admin/orders/:id/approve', async (c) => {
  const id = c.req.param('id')
  const result = await approveDraftAndPromote(id)
  const auditResult = result.ok
    ? result.manual_fulfillment
      ? `approved (manual fulfillment — unsupported SKUs: ${(result.unsupported_skus ?? []).join(', ')})`
      : 'approved + promoted to kitchen'
    : (result.error ?? 'failed')
  recordAuditEvent({
    action: 'order_approve', targetId: id,
    result: auditResult,
    outcome: result.ok ? 'ok' : 'error',
  })
  return c.json(result, result.ok ? 200 : 400)
})

adminRoutes.post('/api/admin/orders/:id/reject', async (c) => {
  const id = c.req.param('id')
  let body: { reason?: string } = {}
  try {
    body = (await c.req.json()) as { reason?: string }
  } catch {}
  const reason = (body.reason ?? '').trim() || 'Owner declined via admin'
  const result = await rejectDraft(id, reason)
  recordAuditEvent({
    action: 'order_reject', targetId: id, result: reason,
    outcome: result.ok ? 'ok' : 'error',
  })
  return c.json(result, result.ok ? 200 : 400)
})

// Unified inbox — WhatsApp + Instagram + website chat in one feed.
// Filter via ?channel=whatsapp|instagram|web|all (default all)
// and ?bucket=new|all|mine (default all).
adminRoutes.get('/api/admin/threads', async (c) => {
  const channel = (c.req.query('channel') ?? 'all') as
    | 'all' | 'whatsapp' | 'instagram' | 'web'
  const bucket = (c.req.query('bucket') ?? 'all') as 'all' | 'new' | 'mine'
  const result = await listInboxThreads({ channel, bucket })
  return c.json(result)
})

adminRoutes.get('/api/admin/threads/:channel/:id', async (c) => {
  const channel = c.req.param('channel') as 'whatsapp' | 'instagram' | 'web'
  const id = decodeURIComponent(c.req.param('id'))
  const thread = await getInboxThread(channel, id)
  if (!thread) return c.json({ ok: false, error: 'thread_not_found' }, 404)
  return c.json(thread)
})

adminRoutes.get('/api/admin/channels', async (c) => {
  const channels = await listChannelStatuses()
  return c.json({ channels })
})

adminRoutes.get('/api/admin/channels/:id', async (c) => {
  const id = c.req.param('id') as ChannelId
  const channel = await getChannelStatus(id)
  if (!channel) return c.json({ ok: false, error: 'unknown_channel' }, 404)
  return c.json(channel)
})

adminRoutes.post('/api/admin/channels/:id/register', async (c) => {
  const id = c.req.param('id') as ChannelId
  const result = await registerChannelWebhook(id)
  recordAuditEvent({
    action: 'channel_register', targetId: id, channel: id,
    result: result.message, outcome: result.ok ? 'ok' : 'error',
  })
  return c.json(result, result.ok ? 200 : 400)
})

adminRoutes.post('/api/admin/channels/:id/test', async (c) => {
  const id = c.req.param('id') as ChannelId
  const result = await sendTestInbound(id)
  recordAuditEvent({
    action: 'channel_test', targetId: id, channel: id,
    result: result.message, outcome: result.ok ? 'ok' : 'error',
  })
  return c.json(result, result.ok ? 200 : 400)
})

// Inject a customer-side inbound on WhatsApp / Instagram with a custom
// handle + message. Sandbox routes it back through our webhook → agent
// → reply, and threads stick to the handle so multiple injects with
// the same number stay in the same conversation. Owner uses this to
// dry-run the agent on real-looking inputs without firing up a phone.
adminRoutes.post('/api/admin/inbox/simulate', async (c) => {
  let body: { channel?: unknown; handle?: unknown; message?: unknown }
  try {
    body = (await c.req.json()) as typeof body
  } catch {
    return c.json({ ok: false, message: 'invalid_json' }, 400)
  }
  const channel = body.channel === 'whatsapp' || body.channel === 'instagram' ? body.channel : null
  if (!channel) {
    return c.json({ ok: false, message: 'channel must be "whatsapp" or "instagram"' }, 400)
  }
  const handle = typeof body.handle === 'string' ? body.handle : ''
  const message = typeof body.message === 'string' ? body.message : ''
  const result = await simulateInbound({ channel, handle, message })
  recordAuditEvent({
    action: 'inbox_simulate',
    targetId: handle.slice(0, 64),
    channel,
    result: result.message,
    outcome: result.ok ? 'ok' : 'error',
  })
  return c.json(result, result.ok ? 200 : 400)
})

// ─── Campaigns ────────────────────────────────────────────────────────
adminRoutes.get('/api/admin/campaigns', async (c) => c.json(await getCampaignsCockpit()))

adminRoutes.get('/api/admin/campaigns/:id', async (c) => {
  const detail = await getCampaignDetail(c.req.param('id'))
  if (!detail) return c.json({ ok: false, error: 'not_found' }, 404)
  return c.json(detail)
})

adminRoutes.post('/api/admin/campaigns/:id/:action', async (c) => {
  const id = c.req.param('id')
  const action = c.req.param('action') as 'pause' | 'resume' | 'adjust'
  if (!['pause', 'resume', 'adjust'].includes(action)) {
    return c.json({ ok: false, error: 'bad_action' }, 400)
  }
  let body: Record<string, unknown> = {}
  try { body = (await c.req.json()) as Record<string, unknown> } catch {}
  const result = await adjustCampaign(id, action, body)
  recordAuditEvent({
    action: ('campaign_' + action) as 'campaign_pause' | 'campaign_resume' | 'campaign_adjust',
    targetId: id,
    result: result.message + (Object.keys(body).length ? ` ${JSON.stringify(body)}` : ''),
    outcome: result.ok ? 'ok' : 'error',
  })
  return c.json(result, result.ok ? 200 : 400)
})

// ─── Approvals (cockpit Posts queue) ──────────────────────────────────
adminRoutes.get('/api/admin/approvals', (c) => {
  const status = (c.req.query('status') ?? 'pending') as ApprovalStatus | 'all'
  return c.json({ approvals: listApprovals({ status }), counts: approvalCounts() })
})

adminRoutes.get('/api/admin/approvals/:id', (c) => {
  const a = getApproval(c.req.param('id'))
  if (!a) return c.json({ ok: false, error: 'not_found' }, 404)
  return c.json(a)
})

adminRoutes.post('/api/admin/approvals/:id/:decision', async (c) => {
  const id = c.req.param('id')
  const decision = c.req.param('decision') as 'approve' | 'reject'
  if (decision !== 'approve' && decision !== 'reject') {
    return c.json({ ok: false, error: 'bad_decision' }, 400)
  }
  let body: { note?: string } = {}
  try { body = (await c.req.json()) as { note?: string } } catch {}
  const result = decision === 'approve'
    ? await approveApproval(id, body.note)
    : rejectApproval(id, body.note)
  recordAuditEvent({
    action: decision === 'approve' ? 'approval_approve' : 'approval_reject',
    targetId: id,
    channel: result.approval?.channel ?? null,
    result: result.approval?.summary
      ? `${decision}: ${result.approval.summary}${body.note ? ` — "${body.note}"` : ''}`
      : (result.error ?? decision),
    outcome: result.ok ? 'ok' : 'error',
  })
  return c.json(result, result.ok ? 200 : 400)
})

// ─── Settings + audit ─────────────────────────────────────────────────
adminRoutes.get('/api/admin/settings', (c) => c.json(getCockpitSettings()))

adminRoutes.get('/api/admin/audit', (c) => {
  const limit = Number(c.req.query('limit') ?? 100)
  const events = listAuditEvents({ limit })
  const counts = auditCounts()
  return c.json({ events, counts })
})

adminRoutes.post('/api/admin/threads/:channel/:id/reply', async (c) => {
  const channel = c.req.param('channel') as 'whatsapp' | 'instagram' | 'web'
  const id = decodeURIComponent(c.req.param('id'))
  let body: { text?: string } = {}
  try {
    body = (await c.req.json()) as { text?: string }
  } catch {}
  const text = (body.text ?? '').trim()
  if (!text) return c.json({ ok: false, error: 'empty_message' }, 400)
  const result = await replyToInboxThread(channel, id, text)
  recordAuditEvent({
    action: 'thread_reply', targetId: id, channel,
    result: text.length > 80 ? text.slice(0, 80) + '…' : text,
    outcome: result.ok ? 'ok' : 'error',
  })
  return c.json(result, result.ok ? 200 : 400)
})

// ─── Applications (careers) ─────────────────────────────────────────────
// List + status transitions + counts. Submission is a public endpoint
// (src/routes/careers.ts); these admin endpoints are owner-only.

adminRoutes.get('/api/admin/applications', (c) => {
  const statusQ = c.req.query('status') as ApplicationStatus | 'all' | undefined
  const roleQ = c.req.query('role') as ApplicationRole | 'all' | undefined
  const limitQ = c.req.query('limit')
  const limit = limitQ ? Math.max(1, Math.min(500, Number.parseInt(limitQ, 10))) : 100
  return c.json({
    applications: listApplications({ status: statusQ, role: roleQ, limit }),
    counts: applicationCounts(),
  })
})

adminRoutes.get('/api/admin/applications/:id', (c) => {
  const app = getApplication(c.req.param('id'))
  if (!app) return c.json({ ok: false, reason: 'not_found' }, 404)
  return c.json(app)
})

adminRoutes.patch('/api/admin/applications/:id', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, reason: 'invalid json' }, 400)
  }
  const merged = { ...(body as object), application_id: c.req.param('id') }
  const parsed = updateApplicationSchema.safeParse(merged)
  if (!parsed.success) {
    return c.json({ ok: false, reason: 'validation failed', issues: parsed.error.issues }, 400)
  }
  const result = updateApplication(parsed.data)
  if (!result.ok) {
    recordAuditEvent({ action: 'application_update', targetId: c.req.param('id'), outcome: 'error', result: result.reason ?? '' })
    return c.json(result, 400)
  }
  recordAuditEvent({
    action: 'application_update', targetId: c.req.param('id'), outcome: 'ok',
    result: parsed.data.status ? `status=${parsed.data.status}` : 'notes',
  })
  return c.json({ ok: true })
})

// ─── Checkout funnel (abandoned cart tracking) ─────────────────────────
// Public submission endpoint is /api/checkout/heartbeat (src/routes/checkouts.ts);
// these admin endpoints surface counts by step + a list with logical
// status (active / abandoned / submitted).

adminRoutes.get('/api/admin/checkouts', (c) => {
  const statusQ = c.req.query('status') as CheckoutStatus | 'all' | undefined
  const stepQ = c.req.query('step') as CheckoutStep | 'all' | undefined
  const limitQ = c.req.query('limit')
  const limit = limitQ ? Math.max(1, Math.min(500, Number.parseInt(limitQ, 10))) : 100
  return c.json({
    checkouts: listCheckouts({ status: statusQ, step: stepQ, limit }),
    counts: checkoutCounts(),
  })
})

adminRoutes.get('/api/admin/checkouts/:id', (c) => {
  const row = getCheckout(c.req.param('id'))
  if (!row) return c.json({ ok: false, reason: 'not_found' }, 404)
  return c.json(row)
})
