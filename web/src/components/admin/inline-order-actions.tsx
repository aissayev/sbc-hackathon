'use client'

// Inline Approve / Reject for a draft order, used by OrdersTable rows.
// One-tap approve. Reject opens a tiny inline reason input — same shape
// as the order-detail page's <OrderActions> but compact for table use.
//
// Posts to /api/admin/orders/:id/{approve,reject}, which is the same
// backend the detail page hits. Refresh on success so the list updates.

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function InlineOrderActions({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [busy, setBusy] = React.useState<'approve' | 'reject' | null>(null)
  const [showReject, setShowReject] = React.useState(false)
  const [reason, setReason] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  async function call(kind: 'approve' | 'reject') {
    if (busy) return
    if (kind === 'reject' && reason.trim().length < 3) {
      setError('Reason — at least 3 characters.')
      return
    }
    setBusy(kind)
    setError(null)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/${kind}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kind === 'reject' ? { reason: reason.trim() } : {}),
      })
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        setError(txt || `Failed to ${kind}.`)
        return
      }
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  // Two-state UI: default shows the two buttons; reject expands inline.
  return (
    <div className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      {!showReject ? (
        <>
          <button
            type="button"
            onClick={() => call('approve')}
            disabled={busy !== null}
            className={cn(
              'inline-flex items-center gap-1 h-8 px-2.5 rounded-md text-xs font-medium transition-colors',
              'bg-emerald-100 text-emerald-900 hover:bg-emerald-200 border border-emerald-300',
              'disabled:opacity-50',
            )}
            title="Approve & start kitchen"
          >
            {busy === 'approve' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            <span>Approve</span>
          </button>
          <button
            type="button"
            onClick={() => setShowReject(true)}
            disabled={busy !== null}
            className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md text-xs font-medium border border-cocoa-700/15 bg-white text-cocoa-900 hover:bg-cream-100 disabled:opacity-50"
            title="Reject"
          >
            <X className="h-3 w-3" />
            <span>Reject</span>
          </button>
        </>
      ) : (
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason"
            autoFocus
            disabled={busy !== null}
            className="h-8 px-2 text-xs rounded-md border border-cocoa-700/15 bg-white focus:outline-none focus:border-sky w-40"
          />
          <button
            type="button"
            onClick={() => call('reject')}
            disabled={busy !== null || reason.trim().length < 3}
            className="h-8 px-2.5 rounded-md text-xs font-medium bg-berry/15 text-berry border border-berry/30 hover:bg-berry/25 disabled:opacity-50 inline-flex items-center gap-1"
          >
            {busy === 'reject' ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
            <span>Send</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setShowReject(false)
              setReason('')
              setError(null)
            }}
            disabled={busy !== null}
            className="h-8 px-2 text-xs text-cocoa-900/65 hover:text-cocoa-900"
          >
            Cancel
          </button>
        </div>
      )}
      {error && (
        <span className="ml-2 text-[11px] text-berry" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}
