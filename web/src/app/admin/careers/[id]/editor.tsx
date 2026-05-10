'use client'

// Status + notes editor for a single application. PATCHes
// /api/admin/applications/:id with whichever field changed. Same UX shape
// as the customer notes editor — explicit save, inline status pill.

import * as React from 'react'
import { useRouter } from 'next/navigation'
import type { AdminApplicationStatus } from '@/lib/api'
import { cn } from '@/lib/utils'

const STATUSES: Array<{ value: AdminApplicationStatus; label: string }> = [
  { value: 'new', label: 'New' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'interview', label: 'Interview' },
  { value: 'hired', label: 'Hired' },
  { value: 'rejected', label: 'Rejected' },
]

export function ApplicationEditor({
  applicationId,
  initialStatus,
  initialNotes,
}: {
  applicationId: string
  initialStatus: AdminApplicationStatus
  initialNotes: string
}) {
  const router = useRouter()
  const [status, setStatus] = React.useState<AdminApplicationStatus>(initialStatus)
  const [notes, setNotes] = React.useState(initialNotes)
  const [savedStatus, setSavedStatus] = React.useState<AdminApplicationStatus>(initialStatus)
  const [savedNotes, setSavedNotes] = React.useState(initialNotes)
  const [phase, setPhase] = React.useState<'idle' | 'saving' | 'ok' | 'err'>('idle')
  const [error, setError] = React.useState<string | null>(null)

  const dirty = status !== savedStatus || notes !== savedNotes

  async function save() {
    if (!dirty || phase === 'saving') return
    setPhase('saving')
    setError(null)
    const payload: Record<string, unknown> = {}
    if (status !== savedStatus) payload.status = status
    if (notes !== savedNotes) payload.notes = notes
    try {
      const res = await fetch(`/api/admin/applications/${encodeURIComponent(applicationId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(body || `HTTP ${res.status}`)
      }
      setSavedStatus(status)
      setSavedNotes(notes)
      setPhase('ok')
      // Refresh server data so a reload reflects the new state immediately
      // (status pill on the list page, counts on the cockpit, etc.).
      router.refresh()
      setTimeout(() => setPhase((s) => (s === 'ok' ? 'idle' : s)), 1500)
    } catch (err) {
      setPhase('err')
      setError((err as Error).message.slice(0, 200))
    }
  }

  return (
    <div className="rounded-md border border-cocoa-700/15 bg-white p-5 space-y-5">
      <div>
        <p className="eyebrow">Status</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => {
                setStatus(s.value)
                if (phase !== 'idle') setPhase('idle')
              }}
              className={cn(
                'inline-flex items-center rounded-full px-3.5 h-8 text-sm border transition-colors',
                status === s.value
                  ? 'bg-cocoa-900 text-cream border-cocoa-900'
                  : 'border-cocoa-700/15 text-cocoa-900 hover:bg-cream-100',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="eyebrow">Notes</p>
        <textarea
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value)
            if (phase !== 'idle') setPhase('idle')
          }}
          placeholder="Phone screen impressions, references, scheduling, anything the next interviewer should know."
          rows={6}
          maxLength={2000}
          className="mt-2 w-full rounded-md border border-cocoa-700/15 bg-cream-50 p-3 text-sm focus:outline-none focus:border-sky"
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-cocoa-900/55">
          {phase === 'saving'
            ? 'Saving…'
            : phase === 'ok'
              ? 'Saved.'
              : phase === 'err'
                ? <span className="text-berry">{error}</span>
                : dirty
                  ? 'Unsaved changes'
                  : 'Up to date'}
        </span>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || phase === 'saving'}
          className="inline-flex items-center rounded-md bg-cocoa-900 text-cream-50 px-4 h-9 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-cocoa-700"
        >
          Save changes
        </button>
      </div>
    </div>
  )
}
