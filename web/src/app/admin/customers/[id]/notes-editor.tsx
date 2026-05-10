'use client'

import * as React from 'react'

// Owner-editable free-form notes. PUTs to /api/admin/customers/[id]/notes
// on save. Optimistic-UI lite: button shows "Saving…" / "Saved" /
// error inline. No autosave — explicit save lets the owner write multiple
// thoughts before flushing.

export function CustomerNotesEditor({
  customerId,
  initialValue,
}: {
  customerId: string
  initialValue: string
}) {
  const [value, setValue] = React.useState(initialValue)
  const [saved, setSaved] = React.useState(initialValue)
  const [state, setState] = React.useState<'idle' | 'saving' | 'ok' | 'err'>('idle')
  const [error, setError] = React.useState<string | null>(null)

  const dirty = value !== saved

  async function save() {
    if (!dirty || state === 'saving') return
    setState('saving')
    setError(null)
    try {
      const res = await fetch(`/api/admin/customers/${encodeURIComponent(customerId)}/notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: value }),
      })
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(body || `HTTP ${res.status}`)
      }
      setSaved(value)
      setState('ok')
      // Reset to idle after a moment so the green pill doesn't linger.
      setTimeout(() => setState((s) => (s === 'ok' ? 'idle' : s)), 1500)
    } catch (err) {
      setState('err')
      setError((err as Error).message.slice(0, 200))
    }
  }

  return (
    <div className="rounded-md border border-cocoa-700/15 bg-white p-5">
      <p className="eyebrow">Notes</p>
      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          if (state === 'ok' || state === 'err') setState('idle')
        }}
        placeholder="Allergies, preferences, delivery instructions — anything Askhat or the team should remember."
        rows={6}
        className="mt-2 w-full rounded-md border border-cocoa-700/15 bg-cream-50 p-3 text-sm focus:outline-none focus:border-sky"
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-xs text-cocoa-900/55">
          {state === 'saving'
            ? 'Saving…'
            : state === 'ok'
              ? 'Saved.'
              : state === 'err'
                ? <span className="text-berry">{error}</span>
                : dirty
                  ? 'Unsaved changes'
                  : 'Up to date'}
        </span>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || state === 'saving'}
          className="inline-flex items-center rounded-md bg-cocoa-900 text-cream-50 px-4 h-9 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-cocoa-700"
        >
          Save notes
        </button>
      </div>
    </div>
  )
}
