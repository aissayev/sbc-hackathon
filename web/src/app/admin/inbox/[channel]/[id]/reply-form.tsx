'use client'

// Owner reply box — sends through the matching channel adapter on the
// backend. Uses native fetch + router.refresh() so the new message
// appears in the transcript as soon as the request returns.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { InboxChannel } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Send, Loader2 } from 'lucide-react'

// Same-origin: handled by the Next route at /api/admin/threads/[channel]/[id]/reply,
// which proxies to the Hono backend. Avoids cross-origin CORS round-trips.

export function ReplyForm({ channel, id }: { channel: InboxChannel; id: string }) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function send() {
    const trimmed = text.trim()
    if (!trimmed) return
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/admin/threads/${channel}/${encodeURIComponent(id)}/reply`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: trimmed }),
          },
        )
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
        if (!res.ok || !data.ok) {
          setError(data.error ?? `Send failed (${res.status})`)
          return
        }
        setText('')
        router.refresh()
      } catch (e) {
        setError((e as Error).message)
      }
    })
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // ⌘/Ctrl+Enter sends — common shortcut, doesn't fight with newlines.
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      send()
    }
  }

  const channelHint =
    channel === 'whatsapp' ? 'Goes out as WhatsApp message.' :
    channel === 'instagram' ? 'Goes out as Instagram DM.' :
    'Appears in the customer\'s open chat tab on the website.'

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); send() }}
      className="rounded-lg border border-cocoa-700/15 bg-white p-3"
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKey}
        placeholder="Type your reply…"
        rows={3}
        className="w-full resize-none border-0 outline-0 ring-0 bg-transparent text-sm placeholder:text-cocoa-900/40 leading-relaxed px-1"
        disabled={pending}
      />
      <div className="mt-2 flex items-center justify-between gap-3 border-t border-cocoa-700/10 pt-2">
        <div className="text-xs text-cocoa-900/55">
          {channelHint}{' '}
          <span className="text-cocoa-900/40">⌘+Enter to send</span>
        </div>
        <Button type="submit" disabled={pending || !text.trim()} size="sm">
          {pending ? (
            <>
              <Loader2 className="animate-spin" />
              Sending
            </>
          ) : (
            <>
              <Send />
              Send
            </>
          )}
        </Button>
      </div>
      {error && (
        <div className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
          {error}
        </div>
      )}
    </form>
  )
}
