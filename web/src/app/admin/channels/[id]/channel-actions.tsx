'use client'

// Per-channel action row — register webhook + send test event. Both POST
// to same-origin proxies which forward to the Hono backend → sandbox MCP.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ChannelId } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw, Zap, CheckCircle2, AlertCircle } from 'lucide-react'

interface Props {
  channelId: ChannelId
  mode: 'live' | 'sandbox' | 'local' | 'down'
}

export function ChannelActions({ channelId, mode }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [pendingAction, setPendingAction] = useState<'register' | 'test' | null>(null)
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null)

  // Web chat + Telegram have no register/test in the sandbox layer.
  if (channelId === 'web' || channelId === 'telegram' || channelId === 'gbp') {
    return (
      <div className="text-xs text-cocoa-900/55 italic">
        No register/test actions for this channel in the sandbox.
      </div>
    )
  }

  function run(action: 'register' | 'test') {
    setFeedback(null)
    setPendingAction(action)
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/admin/channels/${channelId}/${action}`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' } },
        )
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean; message?: string
        }
        setFeedback({
          ok: !!data.ok,
          message: data.message ?? (res.ok ? 'Done.' : `Request failed (${res.status})`),
        })
        // Refresh the page so status / lastEventAt update if the action changed state.
        if (data.ok) router.refresh()
      } catch (e) {
        setFeedback({ ok: false, message: (e as Error).message })
      } finally {
        setPendingAction(null)
      }
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline-sky"
          size="sm"
          onClick={() => run('register')}
          disabled={pending}
        >
          {pending && pendingAction === 'register'
            ? <Loader2 className="animate-spin" />
            : <RefreshCw />}
          Register webhook
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => run('test')}
          disabled={pending || mode === 'down'}
        >
          {pending && pendingAction === 'test'
            ? <Loader2 className="animate-spin" />
            : <Zap />}
          Send test event
        </Button>
      </div>
      {feedback && (
        <div
          className={
            'flex items-start gap-2 rounded-md px-3 py-2 text-xs ' +
            (feedback.ok
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
              : 'bg-red-50 border border-red-200 text-red-900')
          }
        >
          {feedback.ok ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" /> : <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
          <span className="leading-relaxed">{feedback.message}</span>
        </div>
      )}
    </div>
  )
}
