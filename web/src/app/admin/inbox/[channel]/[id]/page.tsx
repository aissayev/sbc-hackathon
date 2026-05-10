// Single thread view + reply box.
//
// The transcript renders chat-bubble style. The reply form is a Client
// Component (`ReplyForm`) — everything else is Server.

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getInboxThread, type InboxChannel } from '@/lib/api'
import { fmtRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ChevronLeft, Phone, Instagram, Globe } from 'lucide-react'
import { ReplyForm } from './reply-form'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ channel: string; id: string }>
}

const VALID_CHANNELS: InboxChannel[] = ['whatsapp', 'instagram', 'web']

export default async function ThreadPage({ params }: PageProps) {
  const { channel, id: rawId } = await params
  if (!VALID_CHANNELS.includes(channel as InboxChannel)) notFound()
  const id = decodeURIComponent(rawId)
  const thread = await getInboxThread(channel as InboxChannel, id)
  if (!thread) notFound()

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/inbox"
        className="inline-flex items-center gap-1 text-sm text-cocoa-700 hover:text-sky transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Inbox
      </Link>

      <div className="mt-4 flex items-center gap-3 pb-4 border-b border-cocoa-700/10">
        <div className={cn('h-12 w-12 rounded-full inline-flex items-center justify-center', headerBg(thread.channel))}>
          <ChannelIcon channel={thread.channel} className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="display-h3 leading-tight">
              {thread.displayName || thread.handle}
            </h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] uppercase tracking-[0.12em] font-medium bg-cocoa-700/10 text-cocoa-900/75">
              {channelFullLabel(thread.channel)}
            </span>
          </div>
          <div className="text-sm text-cocoa-900/60 mt-0.5 truncate">
            {thread.handle}
            {thread.lastMessageAt > 0 && (
              <> · last activity {fmtRelativeTime(thread.lastMessageAt)}</>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {thread.transcript.length === 0 ? (
          <div className="rounded-md bg-cream-100 px-4 py-6 text-sm text-cocoa-900/60 text-center">
            No transcript available for this thread yet.
          </div>
        ) : (
          thread.transcript.map((m, i) => (
            <Bubble key={i} role={m.role} text={m.text} at={m.at} />
          ))
        )}
      </div>

      <div className="mt-8 pt-6 border-t border-cocoa-700/10">
        <ReplyForm channel={thread.channel} id={thread.id} />
      </div>
    </div>
  )
}

function Bubble({ role, text, at }: { role: 'customer' | 'us'; text: string; at: number }) {
  const isUs = role === 'us'
  return (
    <div className={cn('flex', isUs ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm',
          isUs
            ? 'bg-sky text-white rounded-br-md'
            : 'bg-white text-cocoa-900 border border-cocoa-700/10 rounded-bl-md',
        )}
      >
        <div className="whitespace-pre-wrap break-words">{text || <span className="italic opacity-60">(empty)</span>}</div>
        {at > 0 && (
          <div className={cn('text-[10px] mt-1', isUs ? 'text-white/70' : 'text-cocoa-900/50')}>
            {fmtRelativeTime(at)}
          </div>
        )}
      </div>
    </div>
  )
}

function ChannelIcon({ channel, className }: { channel: InboxChannel; className?: string }) {
  if (channel === 'whatsapp') return <Phone className={className} />
  if (channel === 'instagram') return <Instagram className={className} />
  return <Globe className={className} />
}

function headerBg(channel: InboxChannel) {
  if (channel === 'whatsapp') return 'bg-emerald-100 text-emerald-700'
  if (channel === 'instagram') return 'bg-pink-100 text-pink-700'
  return 'bg-sky/15 text-sky-700'
}

function channelFullLabel(channel: InboxChannel) {
  if (channel === 'whatsapp') return 'WhatsApp'
  if (channel === 'instagram') return 'Instagram'
  return 'Website chat'
}
