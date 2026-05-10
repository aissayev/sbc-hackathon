// /admin/logs — combined agent + audit feed for the owner cockpit.
//
// Shows every WA / IG / web / TG event the system has touched in the
// last 7 days, sortable by channel. Each row is one line: when, who
// (channel + thread short), what (role's reply or audit action), how
// much (duration + cost), and an outcome badge.
//
// Server-rendered for fast first paint inside the Telegram Mini App;
// the channel filter uses ?channel= search params so it round-trips
// through Next's standard server-component path (no client fetch).

import Link from 'next/link'
import { listAdminLogs, type LogChannel, type LogRow } from '@/lib/api'
import { fmtRelativeDate } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ channel?: string }>
}

const CHANNELS: Array<{ id: LogChannel | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'web', label: 'Web' },
  { id: 'telegram', label: 'Telegram' },
]

function channelBadge(c: LogChannel): { tone: 'default' | 'sage' | 'blue' | 'coral'; label: string } {
  switch (c) {
    case 'whatsapp':
      return { tone: 'sage', label: 'wa' }
    case 'instagram':
      return { tone: 'coral', label: 'ig' }
    case 'web':
      return { tone: 'blue', label: 'web' }
    case 'telegram':
      return { tone: 'default', label: 'tg' }
    default:
      return { tone: 'default', label: '?' }
  }
}

function shortScope(s: string | null): string {
  if (!s) return '—'
  if (s.length <= 18) return s
  return s.slice(0, 8) + '…' + s.slice(-6)
}

function fmtMs(ms: number | null): string {
  if (ms == null) return ''
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function fmtCost(usd: number | null): string {
  if (usd == null || usd === 0) return ''
  if (usd < 0.005) return '<¢1'
  return `$${usd.toFixed(2)}`
}

export default async function AdminLogsPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const requested = (sp.channel ?? 'all') as LogChannel | 'all'
  const safe: LogChannel | 'all' =
    CHANNELS.find((c) => c.id === requested)?.id ?? 'all'

  const logs = await listAdminLogs({ channel: safe, limit: 200 })

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="display-h3">Logs</h2>
        <p className="text-sm text-cocoa-900/65">
          {logs.total_recent} events · last 7 days
        </p>
      </div>

      {/* Channel filter chips. Click reloads with ?channel=. */}
      <div className="-mx-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-1.5 px-1">
          {CHANNELS.map((c) => {
            const active = c.id === safe
            const count = c.id === 'all' ? logs.total_recent : logs.by_channel[c.id as LogChannel] ?? 0
            return (
              <Link
                key={c.id}
                href={c.id === 'all' ? '/admin/logs' : `/admin/logs?channel=${c.id}`}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-xs whitespace-nowrap',
                  active
                    ? 'bg-cocoa-700 text-cream-50'
                    : 'text-cocoa-900 bg-white hover:bg-cream-100 border border-cocoa-700/15',
                )}
              >
                <span>{c.label}</span>
                <span
                  className={cn(
                    'tabular-nums text-[10px]',
                    active ? 'text-cream-50/80' : 'text-cocoa-900/55',
                  )}
                >
                  {count}
                </span>
              </Link>
            )
          })}
        </div>
      </div>

      {logs.rows.length === 0 ? (
        <div className="rounded-md bg-cream-100 p-6 text-sm text-cocoa-900/70">
          No events yet on this filter. Once WA / IG / web traffic flows, every
          inbound, outbound, and approval lands here.
        </div>
      ) : (
        <ul className="divide-y divide-cocoa-700/10 rounded-md border border-cocoa-700/15 bg-white">
          {logs.rows.map((row) => (
            <LogRowItem key={row.id} row={row} />
          ))}
        </ul>
      )}

      <p className="text-[11px] text-cocoa-900/50">
        Combined feed of agent invocations (every <code>claude -p</code> call) and audit
        actions (approvals, rejections, channel registrations). Tagged by channel via thread-id
        prefix or the audit action's <code>channel</code> column.
      </p>
    </div>
  )
}

function LogRowItem({ row }: { row: LogRow }) {
  const ch = channelBadge(row.channel)
  const isError = row.outcome === 'error'
  return (
    <li className="p-3 sm:p-4">
      <div className="flex items-start gap-3 flex-wrap">
        <span className="text-[11px] tabular-nums text-cocoa-900/55 mt-1 shrink-0 w-24">
          {fmtRelativeDate(row.at)}
        </span>
        <Badge variant={ch.tone}>{ch.label}</Badge>
        <span className="font-mono text-[11px] text-cocoa-900/65 mt-1 truncate max-w-[10rem]" title={row.scope_id ?? ''}>
          {shortScope(row.scope_id)}
        </span>
        <span className="mt-1 text-xs text-cocoa-900/85 flex-1 min-w-0">
          {row.kind === 'agent_call' ? (
            <>
              <span className="text-cocoa-900/55">{row.role} ·</span> {row.summary}
            </>
          ) : (
            <>
              <span className="text-cocoa-900/55">{row.action} ·</span> {row.summary}
            </>
          )}
        </span>
        <span className="mt-1 text-[11px] tabular-nums text-cocoa-900/55 shrink-0">
          {[fmtMs(row.duration_ms), fmtCost(row.cost_usd)].filter(Boolean).join(' · ')}
        </span>
        {isError && <Badge variant="coral">err</Badge>}
      </div>
    </li>
  )
}
