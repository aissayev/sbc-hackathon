// Settings + audit page. Two sections:
//
// 1. Environment health — which secrets are wired, what the sandbox host
//    sees us as, webhook URLs, db row counts. Read-only — secrets are
//    redacted to "set" / "unset" booleans.
// 2. Audit log — every owner-initiated action through the cockpit, most
//    recent first. Searchable by action via ?action=.

import Link from 'next/link'
import { getCockpitSettings, listAuditEvents, type CockpitSettings, type AuditEvent } from '@/lib/api'
import { fmtRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  CheckCircle2, XCircle, AlertCircle, Database, Globe2,
  Shield, Megaphone, MessageSquare, Phone, Send, MapPin,
  RefreshCw, Zap, Inbox, ShoppingBag, Pause, Play, Sliders, X, Check,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const [settings, audit] = await Promise.all([
    getCockpitSettings(),
    listAuditEvents(50),
  ])

  return (
    <div className="space-y-10">
      <section>
        <h2 className="display-h3">Settings</h2>
        <p className="text-sm text-cocoa-900/65 mt-1">
          What's wired, what isn't. Edit secrets in <code className="px-1.5 py-0.5 rounded bg-cream-100 text-xs">.env.local</code> on the backend.
        </p>
      </section>

      {settings ? (
        <>
          <EnvBlock env={settings.env} />
          <WebhooksBlock webhooks={settings.webhooks} />
          <DbBlock db={settings.db} />
        </>
      ) : (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
          Couldn't reach the backend.
        </div>
      )}

      <section>
        <div className="flex items-end justify-between mb-3">
          <div>
            <h3 className="display-h3">Audit log</h3>
            <p className="text-sm text-cocoa-900/65 mt-1">
              Every owner-initiated action. {audit.counts.total} total · {audit.counts.today} today
              {audit.counts.errors > 0 && <> · <span className="text-red-700">{audit.counts.errors} errors</span></>}.
            </p>
          </div>
        </div>
        {audit.events.length === 0 ? (
          <div className="rounded-lg bg-cream-100 border border-cocoa-700/10 p-8 text-center">
            <Shield className="h-7 w-7 mx-auto text-cocoa-900/30" />
            <p className="mt-3 text-sm text-cocoa-900/70">
              No actions logged yet. The first time you reply to a thread, register a webhook, or
              approve an item, it'll show up here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-cocoa-700/10 rounded-lg border border-cocoa-700/15 bg-white">
            {audit.events.map((e) => <AuditRow key={e.id} event={e} />)}
          </ul>
        )}
      </section>
    </div>
  )
}

function EnvBlock({ env }: { env: CockpitSettings['env'] }) {
  const rows: Array<{ label: string; value: string | null; status: 'set' | 'unset' | 'info' }> = [
    { label: 'NODE_ENV', value: env.nodeEnv, status: 'info' },
    { label: 'PUBLIC_URL', value: env.publicUrl ?? '(unset)', status: env.publicUrl ? 'set' : 'unset' },
    { label: 'SBC sandbox MCP', value: env.sandboxMcpUrl ?? '(unset)', status: env.sandboxMcpUrl ? 'info' : 'unset' },
    { label: 'SBC_TEAM_TOKEN', value: env.sandboxTeamToken === 'set' ? '✓ wired' : '(unset — sandbox calls will fail)', status: env.sandboxTeamToken },
    { label: 'TG_OWNER_BOT_TOKEN', value: env.ownerBotToken === 'set' ? '✓ wired' : '(unset — owner bot offline)', status: env.ownerBotToken },
    { label: 'WA_TOKEN', value: env.whatsappToken === 'set' ? `✓ wired${env.whatsappPhoneNumberId ? ` (phone: ${env.whatsappPhoneNumberId})` : ''}` : '(unset)', status: env.whatsappToken },
    { label: 'IG_TOKEN', value: env.instagramToken === 'set' ? '✓ wired' : '(unset)', status: env.instagramToken },
    { label: 'WEB_BACKEND_SECRET', value: env.webBackendSecret === 'set' ? '✓ shared with web' : '(unset — admin reads ride open mode)', status: env.webBackendSecret === 'set' ? 'set' : 'unset' },
  ]
  return (
    <section>
      <h3 className="text-xs uppercase tracking-[0.14em] text-cocoa-900/50 inline-flex items-center gap-1.5">
        <Shield className="h-3.5 w-3.5" /> Environment
      </h3>
      <ul className="mt-3 divide-y divide-cocoa-700/10 rounded-lg border border-cocoa-700/15 bg-white">
        {rows.map((r) => (
          <li key={r.label} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex items-center gap-2">
              <StatusIcon status={r.status} />
              <code className="text-xs font-mono text-cocoa-900/85">{r.label}</code>
            </div>
            <code className={cn('text-xs font-mono truncate max-w-[420px] text-right',
              r.status === 'unset' ? 'text-cocoa-900/45' : 'text-cocoa-900/75')}>
              {r.value}
            </code>
          </li>
        ))}
      </ul>
    </section>
  )
}

function WebhooksBlock({ webhooks }: { webhooks: CockpitSettings['webhooks'] }) {
  return (
    <section>
      <h3 className="text-xs uppercase tracking-[0.14em] text-cocoa-900/50 inline-flex items-center gap-1.5">
        <Globe2 className="h-3.5 w-3.5" /> Webhook URLs
      </h3>
      <p className="text-xs text-cocoa-900/55 mt-1">
        These are what the sandbox would post to. Sets when <code className="px-1 rounded bg-cream-100 text-xs">PUBLIC_URL</code> is configured.
      </p>
      <ul className="mt-3 divide-y divide-cocoa-700/10 rounded-lg border border-cocoa-700/15 bg-white">
        {webhooks.map((w) => (
          <li key={w.channel} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] uppercase tracking-[0.12em] font-medium bg-cocoa-700/10 text-cocoa-900/75">
              {w.channel}
            </span>
            <code className={cn('text-xs font-mono break-all',
              w.url ? 'text-cocoa-900/85' : 'text-cocoa-900/45')}>
              {w.url ?? '(no PUBLIC_URL)'}
            </code>
            <Link
              href={`/admin/channels/${w.channel === 'telegram' ? 'telegram' : w.channel}`}
              className="text-xs text-sky-700 hover:underline whitespace-nowrap"
            >
              Manage →
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function DbBlock({ db }: { db: CockpitSettings['db'] }) {
  return (
    <section>
      <h3 className="text-xs uppercase tracking-[0.14em] text-cocoa-900/50 inline-flex items-center gap-1.5">
        <Database className="h-3.5 w-3.5" /> Local database
      </h3>
      <p className="text-xs text-cocoa-900/55 mt-1">
        SQLite at <code className="px-1 rounded bg-cream-100 text-xs">{db.path}</code>
      </p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {db.tables.map((t) => (
          <li key={t.name} className="rounded-md border border-cocoa-700/10 bg-white px-3 py-2 flex items-center justify-between">
            <code className="text-xs font-mono text-cocoa-900/75">{t.name}</code>
            <span className="text-sm text-cocoa-900/85 tabular-nums">{t.rows.toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function StatusIcon({ status }: { status: 'set' | 'unset' | 'info' }) {
  if (status === 'set') return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
  if (status === 'unset') return <XCircle className="h-3.5 w-3.5 text-cocoa-900/30 shrink-0" />
  return <AlertCircle className="h-3.5 w-3.5 text-sky-600 shrink-0" />
}

function AuditRow({ event }: { event: AuditEvent }) {
  const meta = ACTION_META[event.action] ?? { label: event.action, Icon: Shield, tone: 'bg-cocoa-700/10 text-cocoa-900/75' }
  const Icon = meta.Icon
  return (
    <li className="grid grid-cols-[auto_auto_1fr_auto] items-start gap-3 px-4 py-3">
      <div className={cn('h-7 w-7 rounded-full inline-flex items-center justify-center shrink-0 mt-0.5', meta.tone)}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="text-xs text-cocoa-900/85">
        <div className="font-medium">{meta.label}</div>
        {event.targetId && (
          <code className="text-[11px] font-mono text-cocoa-900/55 break-all">{event.targetId}</code>
        )}
      </div>
      <div className="min-w-0 text-sm text-cocoa-900/75 leading-relaxed truncate" title={event.result ?? ''}>
        {event.result ?? <span className="italic text-cocoa-900/40">no detail</span>}
      </div>
      <div className="text-right shrink-0">
        <div className="text-xs text-cocoa-900/55 whitespace-nowrap">{fmtRelativeTime(event.createdAt)}</div>
        {event.outcome === 'error' && (
          <div className="text-[10px] uppercase tracking-[0.12em] font-medium text-red-700">error</div>
        )}
      </div>
    </li>
  )
}

const ACTION_META: Record<AuditEvent['action'], { label: string; Icon: typeof Shield; tone: string }> = {
  approval_approve: { label: 'Approval · approved', Icon: Check, tone: 'bg-emerald-100 text-emerald-700' },
  approval_reject:  { label: 'Approval · rejected', Icon: X, tone: 'bg-red-100 text-red-700' },
  thread_reply:     { label: 'Reply sent', Icon: MessageSquare, tone: 'bg-sky/15 text-sky-700' },
  channel_register: { label: 'Webhook registered', Icon: RefreshCw, tone: 'bg-amber-100 text-amber-700' },
  channel_test:     { label: 'Test event sent', Icon: Zap, tone: 'bg-amber-100 text-amber-700' },
  campaign_pause:   { label: 'Campaign · paused', Icon: Pause, tone: 'bg-amber-100 text-amber-700' },
  campaign_resume:  { label: 'Campaign · resumed', Icon: Play, tone: 'bg-emerald-100 text-emerald-700' },
  campaign_adjust:  { label: 'Campaign · adjusted', Icon: Sliders, tone: 'bg-blue-100 text-blue-700' },
  order_approve:    { label: 'Order · approved', Icon: ShoppingBag, tone: 'bg-emerald-100 text-emerald-700' },
  order_reject:     { label: 'Order · rejected', Icon: X, tone: 'bg-red-100 text-red-700' },
}
