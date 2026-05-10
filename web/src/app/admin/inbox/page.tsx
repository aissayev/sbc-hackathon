// Owner inbox — unified message list across WhatsApp, Instagram and the
// website chat. Three buckets:
//   • New   — last message is from the customer (no owner reply since)
//   • Mine  — last message is from us (the agent or owner)
//   • All   — both
//
// The buckets reuse the same data; we just filter server-side via
// ?bucket=... so refreshes are cheap.

import Link from 'next/link'
import { listInboxThreads, type InboxChannel, type InboxThreadRow } from '@/lib/api'
import { fmtRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { MessageSquare, Instagram, Phone, Globe, ChevronRight } from 'lucide-react'
import { SimulateInboundComposer } from '@/components/admin/simulate-inbound'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ bucket?: string; channel?: string }>
}

const BUCKETS = [
  { id: 'new', label: 'New' },
  { id: 'all', label: 'All' },
  { id: 'mine', label: 'Mine' },
] as const

const CHANNELS = [
  { id: 'all', label: 'Every channel' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'web', label: 'Website chat' },
] as const

export default async function InboxPage({ searchParams }: PageProps) {
  const params = await searchParams
  const bucket = (BUCKETS.find((b) => b.id === params.bucket)?.id ?? 'new') as
    | 'new' | 'all' | 'mine'
  const channel = (CHANNELS.find((c) => c.id === params.channel)?.id ?? 'all') as
    | 'all' | InboxChannel
  const { threads, counts, errors } = await listInboxThreads({ bucket, channel })

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h2 className="display-h3">Inbox</h2>
          <p className="text-sm text-cocoa-900/65 mt-1">
            Every WhatsApp, Instagram, and website chat thread in one place.
            Reply, mark resolved, or hand back to the agent.
          </p>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="mb-4 rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
          Couldn't reach: {errors.join(', ')}. Showing what we have.
        </div>
      )}

      <SimulateInboundComposer />

      <div className="flex flex-wrap items-center gap-2 mb-4 border-b border-cocoa-700/10 pb-3">
        {BUCKETS.map((b) => {
          const active = bucket === b.id
          const count = counts[b.id]
          return (
            <Link
              key={b.id}
              href={{ pathname: '/admin/inbox', query: { bucket: b.id, channel } }}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 h-9 rounded-md text-sm transition-colors',
                active
                  ? 'bg-sky text-white'
                  : 'text-cocoa-900 hover:bg-cream-100 border border-cocoa-700/15',
              )}
            >
              {b.label}
              <span
                className={cn(
                  'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-medium',
                  active ? 'bg-white/25 text-white' : 'bg-cocoa-700/10 text-cocoa-900/75',
                )}
              >
                {count}
              </span>
            </Link>
          )
        })}

        <div className="ml-auto inline-flex items-center gap-2">
          <span className="text-xs uppercase tracking-[0.14em] text-cocoa-900/50">
            Channel
          </span>
          <div className="inline-flex rounded-md border border-cocoa-700/15 overflow-hidden">
            {CHANNELS.map((c) => {
              const active = channel === c.id
              return (
                <Link
                  key={c.id}
                  href={{ pathname: '/admin/inbox', query: { bucket, channel: c.id } }}
                  className={cn(
                    'px-3 h-9 inline-flex items-center text-xs whitespace-nowrap',
                    active
                      ? 'bg-cocoa-700 text-cream-50'
                      : 'text-cocoa-900 hover:bg-cream-100',
                  )}
                >
                  {c.label}
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      {threads.length === 0 ? (
        <EmptyState bucket={bucket} channel={channel} />
      ) : (
        <ul className="divide-y divide-cocoa-700/10 rounded-lg border border-cocoa-700/15 bg-white">
          {threads.map((t) => (
            <ThreadRow key={`${t.channel}:${t.id}`} thread={t} />
          ))}
        </ul>
      )}
    </div>
  )
}

function ThreadRow({ thread }: { thread: InboxThreadRow }) {
  const Icon = channelIcon(thread.channel)
  return (
    <li>
      <Link
        href={`/admin/inbox/${thread.channel}/${encodeURIComponent(thread.id)}`}
        className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3.5 hover:bg-cream-100/60 transition-colors"
      >
        <div
          className={cn(
            'h-10 w-10 rounded-full inline-flex items-center justify-center shrink-0',
            channelIconBg(thread.channel),
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium text-cocoa-900 truncate">
              {thread.displayName || thread.handle}
            </span>
            <span
              className={cn(
                'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] uppercase tracking-[0.12em] font-medium shrink-0',
                channelChipColor(thread.channel),
              )}
            >
              {channelLabel(thread.channel)}
            </span>
            {thread.bucket === 'new' && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-sky/15 text-sky-700 text-[10px] font-medium uppercase tracking-[0.12em] shrink-0">
                new
              </span>
            )}
          </div>
          <div className="text-sm text-cocoa-900/70 truncate mt-0.5">
            {thread.lastMessage || <span className="italic text-cocoa-900/40">No message yet</span>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-cocoa-900/55 whitespace-nowrap">
            {thread.lastMessageAt > 0 ? fmtRelativeTime(thread.lastMessageAt) : '—'}
          </div>
          <ChevronRight className="h-4 w-4 text-cocoa-900/30 inline-block mt-1" />
        </div>
      </Link>
    </li>
  )
}

function EmptyState({ bucket, channel }: { bucket: string; channel: string }) {
  const msg =
    bucket === 'new' ? "You're all caught up — nothing waiting on a reply."
      : bucket === 'mine' ? "Nothing here yet. Threads you've replied to will land in this bucket."
      : channel === 'all' ? 'No threads yet across any channel.'
      : `No ${channel} threads to show.`
  return (
    <div className="rounded-lg bg-cream-100 border border-cocoa-700/10 p-10 text-center">
      <MessageSquare className="h-8 w-8 mx-auto text-cocoa-900/30" />
      <p className="mt-3 text-sm text-cocoa-900/70">{msg}</p>
    </div>
  )
}

function channelIcon(channel: InboxChannel) {
  if (channel === 'whatsapp') return Phone
  if (channel === 'instagram') return Instagram
  return Globe
}

function channelIconBg(channel: InboxChannel) {
  if (channel === 'whatsapp') return 'bg-emerald-100 text-emerald-700'
  if (channel === 'instagram') return 'bg-pink-100 text-pink-700'
  return 'bg-sky/15 text-sky-700'
}

function channelChipColor(channel: InboxChannel) {
  if (channel === 'whatsapp') return 'bg-emerald-100 text-emerald-800'
  if (channel === 'instagram') return 'bg-pink-100 text-pink-800'
  return 'bg-sky/15 text-sky-800'
}

function channelLabel(channel: InboxChannel) {
  if (channel === 'whatsapp') return 'WA'
  if (channel === 'instagram') return 'IG'
  return 'Web'
}
