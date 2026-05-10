'use client'

// "Simulate inbound message" composer — sits at the top of /admin/inbox
// and lets the owner inject a fake customer message via the sandbox MCP.
// The injected message hits our webhook → concierge agent → reply, and
// the inbox thread for that handle accumulates as a real conversation
// would. Subsequent simulations on the same handle thread together,
// so you can simulate a multi-turn customer dialog by re-using the
// same number / handle.
//
// Backend endpoint: POST /api/admin/inbox/simulate
// {channel: 'whatsapp' | 'instagram', handle: string, message: string}

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Phone, Instagram, Send, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

type Channel = 'whatsapp' | 'instagram'

const PRESETS: Record<Channel, { handle: string; placeholder: string }> = {
  whatsapp: {
    handle: '+12815550199',
    placeholder: 'do you have honey cake today?',
  },
  instagram: {
    handle: 'sugarlandmom',
    placeholder: 'do you ship?',
  },
}

export function SimulateInboundComposer() {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [channel, setChannel] = React.useState<Channel>('whatsapp')
  const [handle, setHandle] = React.useState(PRESETS.whatsapp.handle)
  const [message, setMessage] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [result, setResult] = React.useState<{ ok: boolean; message: string } | null>(null)

  function pickChannel(c: Channel) {
    setChannel(c)
    // Don't overwrite a handle the user is editing — only swap when they're
    // still on a known preset. Lets you punch in `+1408…` once, then flip
    // channels without losing it.
    setHandle((current) =>
      current === PRESETS.whatsapp.handle || current === PRESETS.instagram.handle
        ? PRESETS[c].handle
        : current,
    )
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/inbox/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, handle, message }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      setResult({ ok: res.ok && data.ok === true, message: data.message ?? `HTTP ${res.status}` })
      if (res.ok && data.ok) {
        setMessage('')
        // The injected message is now in the sandbox; the agent's reply is
        // async (sandbox → webhook → claude -p → adapter.send). Poll a few
        // times so the new thread + reply appear without the owner having
        // to manually refresh. Stops after either reply is observed or 12s.
        router.refresh()
        let elapsed = 0
        const interval = 2000
        const timeout = 12_000
        const poll = window.setInterval(() => {
          elapsed += interval
          router.refresh()
          if (elapsed >= timeout) window.clearInterval(poll)
        }, interval)
      }
    } catch (err) {
      setResult({ ok: false, message: (err as Error).message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mb-4 rounded-lg border border-cocoa-700/15 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-3 flex items-center justify-between gap-2 text-left hover:bg-cream-100/60 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-sky/15 text-sky-700">
            <Send className="h-3.5 w-3.5" />
          </span>
          <div>
            <div className="text-sm font-medium text-cocoa-900">Simulate inbound message</div>
            <div className="text-xs text-cocoa-900/60">
              Send a fake WA / IG message via the sandbox to test the agent end-to-end.
            </div>
          </div>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-cocoa-900/50" />
        ) : (
          <ChevronDown className="h-4 w-4 text-cocoa-900/50" />
        )}
      </button>
      {open && (
        <form onSubmit={onSubmit} className="px-4 pb-4 pt-0 border-t border-cocoa-700/10 mt-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2 pt-3">
            <span className="text-xs uppercase tracking-[0.14em] text-cocoa-900/55 mr-1">Channel</span>
            <ChannelPill
              active={channel === 'whatsapp'}
              onClick={() => pickChannel('whatsapp')}
              icon={Phone}
              label="WhatsApp"
              accent="emerald"
            />
            <ChannelPill
              active={channel === 'instagram'}
              onClick={() => pickChannel('instagram')}
              icon={Instagram}
              label="Instagram"
              accent="pink"
            />
          </div>

          <div>
            <label htmlFor="sim-handle" className="text-xs font-medium text-cocoa-900/70">
              {channel === 'whatsapp' ? 'Phone (E.164)' : 'Instagram handle'}
            </label>
            <input
              id="sim-handle"
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder={
                channel === 'whatsapp'
                  ? PRESETS.whatsapp.handle + '   (e.g. +12815551234)'
                  : '@' + PRESETS.instagram.handle
              }
              disabled={submitting}
              className="mt-1 w-full h-10 rounded-md border border-cocoa-700/15 bg-cream-50 px-3 text-sm focus:outline-none focus:border-sky focus:ring-2 focus:ring-sky/25 disabled:opacity-60"
            />
            <p className="mt-1 text-[11px] text-cocoa-900/55">
              {channel === 'whatsapp'
                ? 'Include the + and country code. Same number across messages threads them together.'
                : 'With or without the @. Same handle across messages threads them together.'}
            </p>
          </div>

          <div>
            <label htmlFor="sim-message" className="text-xs font-medium text-cocoa-900/70">
              Message
            </label>
            <textarea
              id="sim-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={PRESETS[channel].placeholder}
              disabled={submitting}
              rows={3}
              className="mt-1 w-full rounded-md border border-cocoa-700/15 bg-cream-50 px-3 py-2 text-sm focus:outline-none focus:border-sky focus:ring-2 focus:ring-sky/25 disabled:opacity-60 resize-y"
            />
          </div>

          {result && (
            <div
              className={cn(
                'text-xs rounded-md px-3 py-2',
                result.ok
                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                  : 'bg-berry/10 text-berry border border-berry/30',
              )}
              role={result.ok ? 'status' : 'alert'}
            >
              {result.ok ? '✓ ' : '✗ '}
              {result.message}
              {result.ok && (
                <span className="block mt-1 text-cocoa-900/70">
                  The agent reply is async — refresh the inbox in a few seconds to see the thread.
                </span>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={submitting || !handle.trim() || !message.trim()}
              className="h-10 inline-flex items-center gap-1.5 rounded-md bg-sky px-4 text-sm font-medium text-white hover:bg-sky-700 transition-colors disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {submitting ? 'Sending…' : 'Send'}
            </button>
            <button
              type="button"
              onClick={() => router.refresh()}
              className="h-10 inline-flex items-center rounded-md border border-cocoa-700/15 px-4 text-sm text-cocoa-900 hover:bg-cream-100"
            >
              Refresh inbox
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

function ChannelPill({
  active,
  onClick,
  icon: Icon,
  label,
  accent,
}: {
  active: boolean
  onClick: () => void
  icon: React.ComponentType<{ className?: string }>
  label: string
  accent: 'emerald' | 'pink'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 h-9 rounded-md text-sm border transition-colors',
        active
          ? accent === 'emerald'
            ? 'bg-emerald-100 border-emerald-300 text-emerald-900'
            : 'bg-pink-100 border-pink-300 text-pink-900'
          : 'bg-white border-cocoa-700/15 text-cocoa-900 hover:bg-cream-100',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}
