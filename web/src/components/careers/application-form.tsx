'use client'

// In-app application form for /careers. Replaces the prior `mailto:`
// fallback so the customer never leaves the site. State machine:
//
//   role-cards-on-page  → "Apply" button sets `roleSlug` → modal opens
//   form-fill           → user fills, hits Submit
//   submitting          → disables form, shows spinner
//   submitted           → swaps to a confirmation card with "back to careers"
//   error               → in-place error string under the submit button
//
// The submit POSTs to /api/careers/apply via Next's same-origin proxy
// (the /careers page is server-rendered; this component is the only
// browser-side surface). The owner gets a Telegram card asynchronously
// (server-side, fire-and-forget) — the form itself doesn't depend on
// that landing.

import * as React from 'react'
import { CAREERS_ROLES, CAREERS_ROLE_LABEL, type CareersRole } from '@/lib/careers'
import { ArrowRight, CheckCircle2, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ApplicationFormState {
  open: boolean
  role: CareersRole | null
  // For role='other' — the free-text "what role do you have in mind".
  roleHint: string
}

const INITIAL: ApplicationFormState = { open: false, role: null, roleHint: '' }

interface CareersApplyContext {
  openFor: (role: CareersRole, roleHint?: string) => void
}

const CareersApplyCtx = React.createContext<CareersApplyContext | null>(null)

/**
 * Wrap the careers page with this provider. Buttons inside (`<ApplyButton/>`)
 * subscribe via `useCareersApply()` and open the shared modal — keeps the
 * modal state at one level above so we don't mount three independent forms.
 */
export function CareersApplyProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<ApplicationFormState>(INITIAL)

  const openFor = React.useCallback((role: CareersRole, roleHint?: string) => {
    setState({ open: true, role, roleHint: roleHint ?? '' })
  }, [])
  const close = React.useCallback(() => setState(INITIAL), [])

  const ctx = React.useMemo(() => ({ openFor }), [openFor])

  // ESC + body scroll-lock while the modal is open.
  React.useEffect(() => {
    if (!state.open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [state.open, close])

  return (
    <CareersApplyCtx.Provider value={ctx}>
      {children}
      {state.open && state.role && (
        <ApplyModal role={state.role} initialHint={state.roleHint} onClose={close} />
      )}
    </CareersApplyCtx.Provider>
  )
}

export function useCareersApply(): CareersApplyContext {
  const ctx = React.useContext(CareersApplyCtx)
  if (!ctx) throw new Error('useCareersApply must be used inside <CareersApplyProvider>')
  return ctx
}

/**
 * Replaces the old `<a href="mailto:...">Apply by email</a>` link on the
 * role cards. Same eyebrow-style chrome; tap opens the modal preset to
 * the right role.
 */
export function ApplyButton({ role, label = 'Apply now', className }: { role: CareersRole; label?: string; className?: string }) {
  const { openFor } = useCareersApply()
  return (
    <button
      type="button"
      onClick={() => openFor(role)}
      className={cn(
        'inline-flex items-center gap-1.5 text-[11px] tracking-[0.18em] uppercase font-medium text-sky-700 hover:text-sky-900 transition-colors',
        className,
      )}
    >
      {label}
      <ArrowRight className="h-3 w-3" />
    </button>
  )
}

/**
 * The "Don't see your role?" CTA on the bottom of /careers. Same modal,
 * preset to role='other' so the form prompts for a free-text role hint.
 */
export function ApplyOtherButton({ className }: { className?: string }) {
  const { openFor } = useCareersApply()
  return (
    <button
      type="button"
      onClick={() => openFor('other')}
      className={cn(
        'inline-flex items-center gap-2 rounded-full bg-sky text-white text-sm font-medium px-5 h-11 hover:bg-sky-700 transition-colors shadow-sm shrink-0',
        className,
      )}
    >
      Send a note <ArrowRight className="h-4 w-4" />
    </button>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────

interface FormValues {
  role: CareersRole
  roleHint: string
  name: string
  email: string
  phone: string
  pitch: string
  portfolioUrl: string
  heardFrom: string
  availability: string
}

function initialValues(role: CareersRole, roleHint: string): FormValues {
  return {
    role,
    roleHint,
    name: '',
    email: '',
    phone: '',
    pitch: '',
    portfolioUrl: '',
    heardFrom: '',
    availability: '',
  }
}

function ApplyModal({
  role,
  initialHint,
  onClose,
}: {
  role: CareersRole
  initialHint: string
  onClose: () => void
}) {
  const [values, setValues] = React.useState<FormValues>(() => initialValues(role, initialHint))
  const [error, setError] = React.useState<string | null>(null)
  const [phase, setPhase] = React.useState<'editing' | 'submitting' | 'done'>('editing')

  const set = <K extends keyof FormValues>(k: K, v: FormValues[K]) =>
    setValues((prev) => ({ ...prev, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (values.name.trim().length < 2) return setError('Tell us your name.')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email)) return setError('Real email, please.')
    if (values.pitch.trim().length < 20) {
      return setError('A couple of sentences about you and what you bring.')
    }
    if (values.role === 'other' && values.roleHint.trim().length < 2) {
      return setError('What role do you have in mind?')
    }

    setPhase('submitting')
    try {
      const res = await fetch('/api/careers/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: values.role,
          role_hint: values.role === 'other' ? values.roleHint : undefined,
          name: values.name.trim(),
          email: values.email.trim(),
          phone: values.phone.trim() || undefined,
          pitch: values.pitch.trim(),
          portfolio_url: values.portfolioUrl.trim() || undefined,
          meta: {
            heard_from: values.heardFrom.trim() || undefined,
            availability: values.availability.trim() || undefined,
          },
        }),
      })
      const ct = res.headers.get('content-type') ?? ''
      if (!ct.toLowerCase().includes('application/json')) {
        throw new Error("Couldn't reach the server — try again in a moment.")
      }
      const data = (await res.json()) as { ok: boolean; reason?: string }
      if (!data.ok) throw new Error(data.reason ?? 'Could not submit your application.')
      setPhase('done')
    } catch (err) {
      setError((err as Error).message)
      setPhase('editing')
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="apply-title"
      className="fixed inset-0 z-50 bg-cocoa-900/55 backdrop-blur-sm flex items-end md:items-center justify-center p-3 md:p-6 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl bg-bakery rounded-t-3xl md:rounded-3xl shadow-lift max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-bakery z-10 flex items-start justify-between gap-3 px-5 py-4 border-b border-cocoa-700/8">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-sky-700 font-medium">
              Apply · {CAREERS_ROLE_LABEL[values.role]}
            </p>
            <h2 id="apply-title" className="mt-1 font-display text-xl text-cocoa-900">
              {phase === 'done' ? 'Thanks — we got it.' : "Tell us about you"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="h-8 w-8 inline-flex items-center justify-center rounded-full text-cocoa-900/70 hover:bg-cream-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {phase === 'done' ? (
          <DoneCard onClose={onClose} />
        ) : (
          <form onSubmit={submit} className="px-5 py-5 space-y-4">
            {values.role === 'other' && (
              <Field
                id="role-hint"
                label="What role do you have in mind?"
                value={values.roleHint}
                onChange={(v) => set('roleHint', v)}
                placeholder="e.g. social media, weekend baker, dishwasher"
                required
              />
            )}
            <div className="grid sm:grid-cols-2 gap-4">
              <Field
                id="name"
                label="Your name"
                value={values.name}
                onChange={(v) => set('name', v)}
                required
                autoComplete="name"
              />
              <Field
                id="email"
                label="Email"
                type="email"
                value={values.email}
                onChange={(v) => set('email', v)}
                required
                autoComplete="email"
              />
            </div>
            <Field
              id="phone"
              label="Phone (optional)"
              type="tel"
              value={values.phone}
              onChange={(v) => set('phone', v)}
              placeholder="(281) 555-0100"
              autoComplete="tel"
            />
            <Textarea
              id="pitch"
              label="A few sentences — who you are and why you'd like to bake with us"
              value={values.pitch}
              onChange={(v) => set('pitch', v)}
              rows={5}
              required
              hint={`${values.pitch.trim().length} / 800`}
              maxLength={800}
            />
            <Field
              id="portfolio"
              label="Portfolio, LinkedIn, or Instagram (optional)"
              type="url"
              value={values.portfolioUrl}
              onChange={(v) => set('portfolioUrl', v)}
              placeholder="https://"
              inputMode="url"
            />
            <div className="grid sm:grid-cols-2 gap-4">
              <Field
                id="availability"
                label="Availability (optional)"
                value={values.availability}
                onChange={(v) => set('availability', v)}
                placeholder="weekends, mornings, flexible…"
              />
              <Field
                id="heard-from"
                label="How'd you hear about us? (optional)"
                value={values.heardFrom}
                onChange={(v) => set('heardFrom', v)}
                placeholder="walked in, friend, IG"
              />
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-md bg-berry/10 text-berry text-sm px-3 py-2 leading-relaxed"
              >
                {error}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <p className="text-[11px] text-cocoa-900/55 max-w-[18rem] leading-relaxed">
                We read every application. You'll hear back within a few business days.
              </p>
              <button
                type="submit"
                disabled={phase === 'submitting'}
                className="inline-flex items-center gap-2 rounded-full bg-sky text-white text-sm font-medium px-5 h-11 hover:bg-sky-700 disabled:opacity-60 transition-colors shadow-sm"
              >
                {phase === 'submitting' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Sending…
                  </>
                ) : (
                  <>Send application <ArrowRight className="h-4 w-4" /></>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function DoneCard({ onClose }: { onClose: () => void }) {
  return (
    <div className="px-5 py-8 text-center">
      <span className="inline-flex h-14 w-14 rounded-full bg-emerald-100 text-emerald-700 items-center justify-center mx-auto">
        <CheckCircle2 className="h-7 w-7" />
      </span>
      <p className="mt-4 text-cocoa-900 leading-relaxed">
        Thanks for applying. We've sent your details over to the team — someone will reach out
        within a few business days. If we move forward we'll set up a short visit to the shop.
      </p>
      <button
        type="button"
        onClick={onClose}
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-cocoa-900 text-cream text-sm font-medium px-5 h-11 hover:bg-cocoa-700"
      >
        Back to careers
      </button>
    </div>
  )
}

// ─── Inputs ───────────────────────────────────────────────────────────

function Field({
  id,
  label,
  value,
  onChange,
  type = 'text',
  required,
  placeholder,
  autoComplete,
  inputMode,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  required?: boolean
  placeholder?: string
  autoComplete?: string
  inputMode?: 'url' | 'tel' | 'email' | 'text'
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-cocoa-900/75">
        {label}
        {required && <span className="text-berry ml-0.5">*</span>}
      </span>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        className="mt-1 w-full rounded-md border border-cocoa-700/15 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky/40"
      />
    </label>
  )
}

function Textarea({
  id,
  label,
  value,
  onChange,
  rows = 4,
  required,
  hint,
  maxLength,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  rows?: number
  required?: boolean
  hint?: string
  maxLength?: number
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-cocoa-900/75">
        {label}
        {required && <span className="text-berry ml-0.5">*</span>}
      </span>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        required={required}
        maxLength={maxLength}
        className="mt-1 w-full rounded-md border border-cocoa-700/15 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky/40 resize-vertical"
      />
      {hint && <span className="block mt-1 text-[10px] text-cocoa-900/55 text-right tabular-nums">{hint}</span>}
    </label>
  )
}
