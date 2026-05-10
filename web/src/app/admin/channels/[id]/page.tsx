// Per-channel page. Same layout for every channel — only quick-action
// buttons differ. The "register webhook" + "send test event" buttons live
// in <ChannelActions/> (client component) so they can hit the proxy with
// loading state.

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getChannel, type ChannelId } from '@/lib/api'
import { fmtRelativeTime } from '@/lib/format'
import { CHANNEL_META, modeLabel, modeDot } from '@/components/admin/channel-meta'
import { ChannelActions } from './channel-actions'
import { cn } from '@/lib/utils'
import { ChevronLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

const VALID: ChannelId[] = ['whatsapp', 'instagram', 'web', 'telegram', 'gbp']

interface PageProps { params: Promise<{ id: string }> }

export default async function ChannelDetailPage(props: PageProps) {
  const { id } = await props.params
  if (!VALID.includes(id as ChannelId)) notFound()
  const channel = await getChannel(id as ChannelId)
  if (!channel) notFound()
  const meta = CHANNEL_META[channel.id]
  const Icon = meta.icon

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/channels"
        className="inline-flex items-center gap-1 text-sm text-cocoa-700 hover:text-sky transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Channels
      </Link>

      <div className="mt-4 flex items-start gap-4 pb-5 border-b border-cocoa-700/10">
        <div className={cn('h-14 w-14 rounded-full inline-flex items-center justify-center shrink-0', meta.iconBg)}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="display-h3 leading-tight">{meta.label}</h2>
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] text-cocoa-900/65">
              <span className={cn('h-2 w-2 rounded-full', modeDot(channel.mode))} />
              {modeLabel(channel.mode)}
            </span>
            <span className="text-xs text-cocoa-900/35">·</span>
            <span className="text-xs text-cocoa-900/65">
              {channel.threadCount} {channel.threadCount === 1 ? 'thread' : 'threads'}
            </span>
            {channel.lastEventAt > 0 && (
              <>
                <span className="text-xs text-cocoa-900/35">·</span>
                <span className="text-xs text-cocoa-900/65">
                  Last event {fmtRelativeTime(channel.lastEventAt)}
                </span>
              </>
            )}
          </div>
          <p className="mt-2 text-sm text-cocoa-900/70 leading-relaxed">{meta.description}</p>
          {channel.notes && (
            <p className="mt-2 text-xs text-cocoa-900/55 italic">{channel.notes}</p>
          )}
        </div>
      </div>

      <section className="mt-6">
        <h3 className="text-xs uppercase tracking-[0.14em] text-cocoa-900/50">
          Webhook & app
        </h3>
        <div className="mt-3 rounded-xl border border-cocoa-700/12 bg-white p-4 space-y-4">
          <WebhookRow channel={channel.id} url={channel.webhookUrl} />
          <ChannelActions channelId={channel.id} mode={channel.mode} />
        </div>
      </section>

      <section className="mt-8">
        <h3 className="text-xs uppercase tracking-[0.14em] text-cocoa-900/50">
          Quick links
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <QuickLink href={`/admin/inbox?channel=${channel.id === 'gbp' ? 'all' : channel.id}`}>
            {channel.id === 'gbp' ? 'See reviews queue' : 'Open inbox'}
          </QuickLink>
          {channel.id !== 'gbp' && (
            <QuickLink href={`/admin/inbox?bucket=new&channel=${channel.id}`}>
              New only
            </QuickLink>
          )}
        </div>
      </section>
    </div>
  )
}

function WebhookRow({ channel, url }: { channel: ChannelId; url?: string }) {
  if (channel === 'web' || channel === 'gbp') {
    return (
      <div className="text-sm text-cocoa-900/65">
        {channel === 'web'
          ? 'No external webhook — messages land directly in our SQLite when the widget posts.'
          : 'GBP reviews + posts are pulled, not webhook-pushed.'}
      </div>
    )
  }
  if (!url) {
    return (
      <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
        <strong>PUBLIC_URL not set</strong> on the backend. Set it
        (e.g. <code className="px-1 rounded bg-amber-100">https://abc.ngrok.io</code>) and restart
        before registering. Otherwise the sandbox can't reach you.
      </div>
    )
  }
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.14em] text-cocoa-900/50">Webhook URL</div>
      <code className="mt-1 inline-block max-w-full px-2 py-1 rounded bg-cream-100 text-xs text-cocoa-900 font-mono break-all">
        {url}
      </code>
    </div>
  )
}

function QuickLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 px-3 h-9 rounded-md border border-cocoa-700/15 text-sm text-cocoa-900 hover:bg-cream-100 hover:border-sky/40 transition-colors"
    >
      {children}
    </Link>
  )
}
