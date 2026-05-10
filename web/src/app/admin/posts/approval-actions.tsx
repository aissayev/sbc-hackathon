'use client'

// Approve / Reject buttons + optional note. Calls same-origin proxy
// /api/admin/approvals/[id]/[decision] which forwards to the backend.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Check, X, Loader2 } from 'lucide-react'

export function ApprovalActions({ id }: { id: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [pendingDecision, setPendingDecision] = useState<'approve' | 'reject' | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  function decide(decision: 'approve' | 'reject') {
    setError(null)
    setPendingDecision(decision)
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/admin/approvals/${encodeURIComponent(id)}/${decision}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ note: note.trim() || undefined }),
          },
        )
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
        if (!data.ok) {
          setError(data.error ?? `Failed (${res.status})`)
          return
        }
        router.refresh()
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setPendingDecision(null)
      }
    })
  }

  return (
    <div className="space-y-2">
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note for the audit log…"
        className="w-full rounded-md border border-cocoa-700/15 bg-white px-3 h-9 text-sm placeholder:text-cocoa-900/40 focus:outline-none focus:border-sky/50"
        disabled={pending}
      />
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={() => decide('approve')} disabled={pending}>
          {pending && pendingDecision === 'approve' ? <Loader2 className="animate-spin" /> : <Check />}
          Approve & send
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => decide('reject')} disabled={pending}>
          {pending && pendingDecision === 'reject' ? <Loader2 className="animate-spin" /> : <X />}
          Reject
        </Button>
      </div>
      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
          {error}
        </div>
      )}
    </div>
  )
}
