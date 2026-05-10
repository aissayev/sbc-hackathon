'use client'

import * as React from 'react'
import { Mail, Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Newsletter signup. POSTs to /api/leads/newsletter (existing lead-capture
// route) with { contact: email, meta: { source: 'home-newsletter' } }.
// Owner gets a one-line TG card via the existing notifyOwnerOfLead helper.
//
// Slim band, sky-tinted, sits before the closing CTA. Single email field,
// single submit button, success state in place.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function NewsletterBand() {
  const [email, setEmail] = React.useState('')
  const [state, setState] = React.useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = React.useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (state === 'sending' || state === 'sent') return
    if (!EMAIL_RE.test(email.trim())) {
      setError('That doesn\'t look like an email — try again?')
      return
    }
    setState('sending')
    setError(null)
    try {
      const res = await fetch('/api/leads/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact: email.trim(),
          meta: { source: 'home-newsletter', captured_at: new Date().toISOString() },
        }),
      })
      const ct = res.headers.get('content-type') ?? ''
      if (!ct.toLowerCase().includes('application/json')) throw new Error('offline')
      const data = (await res.json()) as { ok?: boolean; reason?: string; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.reason ?? data.error ?? 'failed')
      setState('sent')
    } catch (err) {
      setState('error')
      const m = (err as Error).message
      setError(
        m === 'offline'
          ? "Sorry — our system is offline right now. Try again in a minute."
          : "Couldn't add you. Try again, or DM us on Instagram.",
      )
    }
  }

  return (
    <section className="container mt-24" aria-labelledby="newsletter-heading">
      <div className="rounded-[28px] bg-sky/8 border border-sky/20 p-8 md:p-12 grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] font-medium text-sky-700">
            <Mail className="h-3.5 w-3.5" /> Stay in the loop
          </div>
          <h2 id="newsletter-heading" className="display-h2 mt-3 text-3xl md:text-4xl">
            New cakes, seasonal bakes, owner notes.
          </h2>
          <p className="mt-3 text-cocoa-900/75 max-w-xl leading-relaxed">
            One short email a month. New flavors, holiday pre-order windows, the occasional
            recipe note from Askhat. Easy unsubscribe.
          </p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="grid gap-2 sm:grid-cols-[1fr_auto] sm:min-w-[420px]"
        >
          {state === 'sent' ? (
            <div className="sm:col-span-2 inline-flex items-center gap-2 rounded-full bg-emerald-100 text-emerald-800 px-4 py-3 text-sm font-medium">
              <Check className="h-4 w-4" /> You&apos;re in. Watch your inbox.
            </div>
          ) : (
            <>
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (error) setError(null)
                  if (state === 'error') setState('idle')
                }}
                className="bg-cream"
                aria-invalid={state === 'error' || undefined}
                aria-describedby="newsletter-error"
              />
              <Button type="submit" variant="sky" disabled={state === 'sending'}>
                {state === 'sending' ? 'Adding…' : 'Sign me up'}
              </Button>
              <p
                id="newsletter-error"
                role="alert"
                className={cn(
                  'sm:col-span-2 text-xs leading-relaxed',
                  error ? 'text-berry' : 'text-cocoa-900/55',
                )}
              >
                {error ?? 'We email less than once a month. No third parties.'}
              </p>
            </>
          )}
        </form>
      </div>
    </section>
  )
}
