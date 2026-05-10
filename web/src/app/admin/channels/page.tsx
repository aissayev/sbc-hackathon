// Channels grid — BotFather-style entry point. One card per channel,
// status dot, recent thread count, click into a per-channel page.

import Link from 'next/link'
import { listChannels, type ChannelStatus } from '@/lib/api'
import { fmtRelativeTime } from '@/lib/format'
import { CHANNEL_META, modeLabel, modeDot } from '@/components/admin/channel-meta'
import { cn } from '@/lib/utils'
import { ChevronRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ChannelsPage() {
  const channels = await listChannels()

  return (
    <div>
      <div className="mb-5">
        <h2 className="display-h3">Channels</h2>
        <p className="text-sm text-cocoa-900/65 mt-1">
          One card per surface customers can reach you on. Click in to see
          activity, register webhooks, or send a test event.
        </p>
      </div>

      {channels.length === 0 ? (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
          Couldn't reach the backend. Make sure it's running on
          <code className="mx-1 px-1.5 rounded bg-amber-100 text-xs">localhost:3000</code>.
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {channels.map((c) => <ChannelCard key={c.id} channel={c} />)}
        </ul>
      )}
    </div>
  )
}

function ChannelCard({ channel }: { channel: ChannelStatus }) {
  const meta = CHANNEL_META[channel.id]
  const Icon = meta.icon
  return (
    <li>
      <Link
        href={`/admin/channels/${channel.id}`}
        className="group block rounded-2xl border border-cocoa-700/12 bg-white p-5 hover:border-sky/35 hover:shadow-md transition-all hover:-translate-y-0.5"
      >
        <div className="flex items-start gap-3">
          <div className={cn('h-11 w-11 rounded-full inline-flex items-center justify-center shrink-0', meta.iconBg)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-display text-lg text-cocoa-900 truncate">
                {meta.label}
              </span>
              <ChevronRight className="h-4 w-4 text-cocoa-900/30 ml-auto group-hover:text-sky-700 group-hover:translate-x-0.5 transition-all" />
            </div>
            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
              <span className={cn('h-1.5 w-1.5 rounded-full', modeDot(channel.mode))} />
              <span className="text-xs uppercase tracking-[0.14em] text-cocoa-900/55">
                {modeLabel(channel.mode)}
              </span>
              {/* Real-Meta credential pill — only shown for channels that
                  HAVE a real-Meta path (WA, IG). Tells the operator at a
                  glance whether real customers would actually be reached. */}
              {channel.liveMeta && channel.liveMeta.state !== 'unsupported' && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 h-5 text-[10px] uppercase tracking-[0.12em] font-medium',
                    channel.liveMeta.state === 'complete' && 'bg-emerald-50 text-emerald-700 border border-emerald-200',
                    channel.liveMeta.state === 'partial' && 'bg-amber-50 text-amber-800 border border-amber-200',
                    channel.liveMeta.state === 'unset' && 'bg-cocoa-100 text-cocoa-900/65 border border-cocoa-700/15',
                  )}
                  title={channel.liveMeta.summary}
                >
                  {channel.liveMeta.state === 'complete' && '● Live Meta'}
                  {channel.liveMeta.state === 'partial' && '◑ Partial creds'}
                  {channel.liveMeta.state === 'unset' && '○ Sandbox only'}
                </span>
              )}
              <span className="text-xs text-cocoa-900/40">·</span>
              <span className="text-xs text-cocoa-900/55">
                {channel.threadCount} {channel.threadCount === 1 ? 'thread' : 'threads'}
              </span>
            </div>
          </div>
        </div>

        <p className="mt-3 text-sm text-cocoa-900/70 leading-relaxed">
          {meta.description}
        </p>

        <div className="mt-4 pt-3 border-t border-cocoa-700/8 flex items-center justify-between text-xs text-cocoa-900/55 gap-3">
          <span className="shrink-0">
            {channel.lastEventAt > 0 ? `Last event ${fmtRelativeTime(channel.lastEventAt)}` : 'No events yet'}
          </span>
          {/* Surface notes whenever something is off — sandbox down OR real
              Meta partially wired. The detail page shows the full summary;
              here we truncate. */}
          {channel.notes && (channel.mode === 'down' || channel.liveMeta?.state === 'partial') && (
            <span className="text-amber-700 truncate">⚠ {channel.notes.slice(0, 60)}…</span>
          )}
        </div>
      </Link>
    </li>
  )
}
