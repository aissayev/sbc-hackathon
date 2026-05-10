'use client'

// Campaign actions — Pause / Resume / Adjust budget. Each calls a
// same-origin proxy that forwards to marketing_adjust_campaign in the
// sandbox. Local-plan campaigns (not yet launched) get a "Launch" hint
// instead — actual launch is the marketing agent's job.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Pause, Play, Sliders, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

interface Props {
  campaignId: string
  status?: 'draft' | 'queued' | 'running' | 'paused' | 'closed' | 'unknown'
  source: 'sandbox' | 'local-plan'
}

export function CampaignActions({ campaignId, status, source }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [pendingAction, setPendingAction] = useState<'pause' | 'resume' | 'adjust' | null>(null)
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null)

  if (source === 'local-plan') {
    return (
      <div className="mt-3 rounded-md bg-cream-100 px-4 py-3 text-sm text-cocoa-900/75">
        This is a planned strategy from <code className="px-1 rounded bg-white text-xs">data/campaigns/plans.json</code>.
        Ask the marketing agent to launch it via{' '}
        <code className="px-1 rounded bg-white text-xs">marketing_create_campaign</code>.
      </div>
    )
  }

  function run(action: 'pause' | 'resume' | 'adjust', payload?: Record<string, unknown>) {
    setFeedback(null)
    setPendingAction(action)
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/admin/campaigns/${encodeURIComponent(campaignId)}/${action}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload ?? {}),
          },
        )
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean; message?: string
        }
        setFeedback({
          ok: !!data.ok,
          message: data.message ?? (res.ok ? 'Done.' : `Request failed (${res.status})`),
        })
        if (data.ok) router.refresh()
      } catch (e) {
        setFeedback({ ok: false, message: (e as Error).message })
      } finally {
        setPendingAction(null)
      }
    })
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap gap-2">
        {status === 'paused' ? (
          <Button type="button" size="sm" onClick={() => run('resume')} disabled={pending}>
            {pending && pendingAction === 'resume' ? <Loader2 className="animate-spin" /> : <Play />}
            Resume
          </Button>
        ) : (
          <Button type="button" size="sm" variant="outline" onClick={() => run('pause')} disabled={pending || status === 'closed'}>
            {pending && pendingAction === 'pause' ? <Loader2 className="animate-spin" /> : <Pause />}
            Pause
          </Button>
        )}
        <Button type="button" size="sm" variant="outline-sky" onClick={() => run('adjust', { bumpBudgetUsd: 50 })} disabled={pending}>
          {pending && pendingAction === 'adjust' ? <Loader2 className="animate-spin" /> : <Sliders />}
          Bump budget +$50
        </Button>
      </div>
      {feedback && (
        <div className={
          'flex items-start gap-2 rounded-md px-3 py-2 text-xs ' +
          (feedback.ok
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
            : 'bg-red-50 border border-red-200 text-red-900')
        }>
          {feedback.ok ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" /> : <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
          <span className="leading-relaxed">{feedback.message}</span>
        </div>
      )}
    </div>
  )
}
