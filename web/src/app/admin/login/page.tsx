'use client'

// Owner login page. Reachable when the user hits any /admin/* path
// without a valid session cookie AND a password has already been set.
// (When no password is set, the layout redirects to /admin/setup
// instead.)
//
// Client component end-to-end — small enough that the SSR/CSR split
// isn't worth the ceremony, and the form needs router-side redirect
// on success.

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const search = useSearchParams()
  const next = search.get('next') ?? '/admin/today'

  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        // Generic message — never leak whether the password exists.
        setError('Sign in failed. Check the password and try again.')
        setSubmitting(false)
        return
      }
      // Cookie is set; navigate to the originally-requested page.
      router.push(next)
      router.refresh()
    } catch {
      setError("Network error. We can't reach the server right now.")
      setSubmitting(false)
    }
  }

  return (
    <div className="container max-w-sm pt-16 pb-10 min-h-[60vh]">
      <h1 className="display-h2 mb-2">Owner sign in</h1>
      <p className="text-sm text-cocoa-900/70 mb-8">
        Enter the owner password to access the cockpit. If you launched this from the Telegram
        bot, you should already be in — try reopening from the bot.
      </p>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className="text-sm font-medium text-cocoa-900">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            className="mt-1.5 w-full h-11 rounded-xl border border-cocoa-700/15 bg-cream-50 px-4 text-sm focus:outline-none focus:border-sky focus:ring-2 focus:ring-sky/25 disabled:opacity-60"
          />
        </div>
        {error && (
          <p className="text-sm text-berry bg-berry/10 rounded-md px-3 py-2" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting || !password}
          className="w-full h-11 rounded-xl bg-sky text-white font-medium text-sm hover:bg-sky-700 transition-colors disabled:opacity-50"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
