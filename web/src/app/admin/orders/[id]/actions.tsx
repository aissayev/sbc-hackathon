'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Check, X } from 'lucide-react'

export function OrderActions({ orderId, status }: { orderId: string; status: string }) {
  const router = useRouter()
  const [reason, setReason] = React.useState('')
  const [busy, setBusy] = React.useState<'approve' | 'reject' | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  if (!['draft'].includes(status)) {
    return <p className="mt-2 text-sm text-happy-900/60">Already moved past approval. No actions to take.</p>
  }

  async function call(kind: 'approve' | 'reject') {
    setBusy(kind)
    setError(null)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/${kind}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kind === 'reject' ? { reason } : {}),
      })
      if (!res.ok) {
        const txt = await res.text()
        setError(txt || `Failed to ${kind} the order.`)
        return
      }
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mt-3 space-y-3">
      <Button onClick={() => call('approve')} disabled={busy !== null} className="w-full">
        <Check /> Approve & start kitchen
      </Button>
      <details className="rounded-md border border-happy-700/15">
        <summary className="cursor-pointer p-3 text-sm text-happy-900">Reject this order</summary>
        <div className="p-3 pt-0 space-y-2">
          <Textarea
            placeholder="Reason — kept private. We'll send the customer a kind note."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button
            variant="destructive"
            onClick={() => call('reject')}
            disabled={busy !== null || reason.trim().length < 3}
            className="w-full"
          >
            <X /> Reject
          </Button>
        </div>
      </details>
      {error && (
        <p className="text-xs text-coral bg-coral/10 rounded-md p-2" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
