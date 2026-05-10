'use client'

// First-run owner password setup. Reachable only when no password has
// been set yet (the admin layout's server-side redirect sends the
// owner here on first visit). After successful setup the cookie is
// already set on the response — we just navigate to /admin/today.
//
// If a password is ALREADY set, the backend returns 409 and we kick
// the user over to /admin/login (someone else got here first, or the
// setup ran in another tab).

import * as React from 'react'
import { useRouter } from 'next/navigation'

export default function SetupPage() {
  const router = useRouter()
  const [password, setPassword] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  const tooShort = password.length > 0 && password.length < 8
  const mismatch = confirm.length > 0 && password !== confirm
  const canSubmit = password.length >= 8 && password === confirm && !submitting

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, confirm }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; reason?: string }
      if (res.status === 409) {
        // Already set — likely racy double-tab. Send the user to login.
        router.push('/admin/login')
        return
      }
      if (!res.ok || data.ok !== true) {
        setError(data.reason ?? 'Setup failed. Try again.')
        setSubmitting(false)
        return
      }
      router.push('/admin/today')
      router.refresh()
    } catch {
      setError("Network error. We can't reach the server right now.")
      setSubmitting(false)
    }
  }

  return (
    <div className="container max-w-sm pt-16 pb-10 min-h-[60vh]">
      <h1 className="display-h2 mb-2">Set the owner password</h1>
      <p className="text-sm text-cocoa-900/70 mb-8">
        First time setup. Pick a password — at least 8 characters. You'll use it to sign into the
        cockpit from a browser. (Inside Telegram you're already signed in via the bot.)
      </p>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className="text-sm font-medium text-cocoa-900">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            className="mt-1.5 w-full h-11 rounded-xl border border-cocoa-700/15 bg-cream-50 px-4 text-sm focus:outline-none focus:border-sky focus:ring-2 focus:ring-sky/25 disabled:opacity-60"
          />
          {tooShort && (
            <p className="mt-1 text-xs text-berry">At least 8 characters.</p>
          )}
        </div>
        <div>
          <label htmlFor="confirm" className="text-sm font-medium text-cocoa-900">
            Confirm password
          </label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={submitting}
            className="mt-1.5 w-full h-11 rounded-xl border border-cocoa-700/15 bg-cream-50 px-4 text-sm focus:outline-none focus:border-sky focus:ring-2 focus:ring-sky/25 disabled:opacity-60"
          />
          {mismatch && (
            <p className="mt-1 text-xs text-berry">Passwords don't match.</p>
          )}
        </div>
        {error && (
          <p className="text-sm text-berry bg-berry/10 rounded-md px-3 py-2" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full h-11 rounded-xl bg-sky text-white font-medium text-sm hover:bg-sky-700 transition-colors disabled:opacity-50"
        >
          {submitting ? 'Saving…' : 'Set password and continue'}
        </button>
      </form>
    </div>
  )
}
