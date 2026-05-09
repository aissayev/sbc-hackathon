'use client'

import * as React from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, Send, Building2 } from 'lucide-react'

import {
  b2bSchema,
  type B2BValues,
  INQUIRY_TYPES,
  HEADCOUNTS,
  CADENCES,
  BUDGETS,
  DIETARY_NEEDS,
  formatB2BSpec,
} from '@/lib/b2b'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type StepKey = 'fit' | 'when' | 'budget' | 'contact' | 'review'

const STEPS: Array<{ key: StepKey; label: string; subtitle: string }> = [
  { key: 'fit', label: 'What kind of fit', subtitle: 'Office, event, gifting, or a standing program?' },
  { key: 'when', label: 'How many + how often', subtitle: 'Headcount, cadence, and the first date.' },
  { key: 'budget', label: 'Budget + dietary', subtitle: 'Helps us scope the right package.' },
  { key: 'contact', label: 'Who do we talk to', subtitle: 'Askhat replies within one business day.' },
  { key: 'review', label: 'Review & send', subtitle: 'Quick scan before we forward to the owner.' },
]

const STEP_FIELDS: Record<StepKey, (keyof B2BValues)[]> = {
  fit: ['type'],
  when: ['headcount', 'cadence', 'first_date'],
  budget: ['budget', 'dietary'],
  contact: ['contact_name', 'contact_email', 'contact_phone', 'company', 'notes'],
  review: [],
}

// Map /business package slugs to inquiry-type values so deep-links from the
// landing page pre-select the right tile.
const TYPE_FROM_SLUG: Record<string, string> = {
  'office-breaks': 'office',
  events: 'event',
  gifting: 'gifting',
}

export function B2BInquireForm() {
  const router = useRouter()
  const search = useSearchParams()
  const [stepIdx, setStepIdx] = React.useState(0)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const seededType = TYPE_FROM_SLUG[search.get('type') ?? ''] ?? ''

  const form = useForm<B2BValues>({
    resolver: zodResolver(b2bSchema),
    mode: 'onChange',
    defaultValues: {
      type: seededType,
      headcount: '',
      cadence: '',
      first_date: defaultDate(),
      budget: '',
      dietary: [],
      contact_name: '',
      contact_email: '',
      contact_phone: '',
      company: '',
      notes: '',
    },
  })

  const step = STEPS[stepIdx]
  const isLast = stepIdx === STEPS.length - 1

  async function onNext() {
    const fields = STEP_FIELDS[step.key]
    const ok = fields.length === 0 || (await form.trigger(fields))
    if (!ok) return
    if (isLast) {
      await submit()
      return
    }
    setStepIdx((i) => i + 1)
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  }

  function onBack() {
    setStepIdx((i) => Math.max(0, i - 1))
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  }

  async function submit() {
    const values = form.getValues()
    setSubmitting(true)
    setError(null)
    try {
      const payload = {
        contact: values.contact_email || values.contact_phone || values.contact_name,
        meta: {
          company: values.company,
          contact_name: values.contact_name,
          contact_email: values.contact_email,
          contact_phone: values.contact_phone,
          first_date: values.first_date,
          headcount: values.headcount,
          cadence: values.cadence,
          budget: values.budget,
          dietary: values.dietary,
          inquiry_type: values.type,
          notes: values.notes,
          formatted: formatB2BSpec(values),
        },
      }
      const res = await fetch('/api/leads/b2b', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const ct = res.headers.get('content-type') ?? ''
      if (!ct.toLowerCase().includes('application/json')) {
        setError('Couldn\'t reach the kitchen system. Try again in a minute, or email us.')
        return
      }
      const data = (await res.json()) as { ok?: boolean; lead_id?: string; reason?: string; error?: string }
      if (!data.ok || !data.lead_id) {
        setError(data.reason ?? data.error ?? 'Something hiccupped on our side. Try again, or email us.')
        return
      }
      router.push(`/business/inquire/sent?id=${data.lead_id}`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <ProgressRail stepIdx={stepIdx} />

      <div className="mt-8">
        <h2 className="display-h2">{step.label}</h2>
        <p className="mt-1 text-cocoa-900/70">{step.subtitle}</p>
      </div>

      <div className="mt-8 animate-fade-in">
        {step.key === 'fit' && <FitStep form={form} />}
        {step.key === 'when' && <WhenStep form={form} />}
        {step.key === 'budget' && <BudgetStep form={form} />}
        {step.key === 'contact' && <ContactStep form={form} />}
        {step.key === 'review' && <ReviewStep form={form} />}
      </div>

      {error && (
        <p className="mt-6 text-sm text-berry bg-berry-100 rounded-xl p-3" role="alert">
          {error}
        </p>
      )}

      <div className="mt-10 flex items-center justify-between gap-3">
        {stepIdx > 0 ? (
          <Button type="button" variant="ghost" onClick={onBack} disabled={submitting}>
            <ArrowLeft /> Back
          </Button>
        ) : (
          <span />
        )}
        <Button
          type="button"
          onClick={onNext}
          disabled={submitting}
          size="lg"
          variant={isLast ? 'sky' : 'default'}
          className="min-w-[200px]"
        >
          {isLast ? (
            <>
              <Send /> {submitting ? 'Sending…' : 'Send inquiry'}
            </>
          ) : (
            <>
              Next <ArrowRight />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

function ProgressRail({ stepIdx }: { stepIdx: number }) {
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((s, i) => {
        const done = i < stepIdx
        const current = i === stepIdx
        return (
          <li key={s.key} className="flex items-center gap-2 flex-1">
            <div
              className={cn(
                'h-8 w-8 rounded-full inline-flex items-center justify-center text-xs font-medium shrink-0 transition-colors',
                done && 'bg-sky text-white',
                current && 'bg-cocoa-700 text-cream',
                !done && !current && 'bg-cream-200 text-cocoa-900/40',
              )}
            >
              {done ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <span
                className={cn('h-0.5 flex-1 transition-colors', i < stepIdx ? 'bg-sky' : 'bg-cream-200')}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}

function FitStep({ form }: { form: ReturnType<typeof useForm<B2BValues>> }) {
  return (
    <Controller
      control={form.control}
      name="type"
      render={({ field, fieldState }) => (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {INQUIRY_TYPES.map((t) => (
              <button
                type="button"
                key={t.value}
                onClick={() => field.onChange(t.value)}
                className={cn(
                  'rounded-2xl border p-5 text-left transition-all',
                  field.value === t.value
                    ? 'border-sky bg-sky/5 shadow-ring'
                    : 'border-cocoa-700/15 bg-bakery hover:bg-cream-100',
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{t.icon}</span>
                  <div>
                    <div className="font-medium text-cocoa-900">{t.label}</div>
                    <p className="mt-1 text-sm text-cocoa-900/70 leading-relaxed">{t.body}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          {fieldState.error && <Err>{fieldState.error.message}</Err>}
        </>
      )}
    />
  )
}

function WhenStep({ form }: { form: ReturnType<typeof useForm<B2BValues>> }) {
  return (
    <div className="space-y-6">
      <div>
        <Label className="text-base">How many people will eat?</Label>
        <Controller
          control={form.control}
          name="headcount"
          render={({ field, fieldState }) => (
            <>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2">
                {HEADCOUNTS.map((h) => (
                  <Tile key={h.value} selected={field.value === h.value} onClick={() => field.onChange(h.value)}>
                    {h.label}
                  </Tile>
                ))}
              </div>
              {fieldState.error && <Err>{fieldState.error.message}</Err>}
            </>
          )}
        />
      </div>
      <div>
        <Label className="text-base">How often?</Label>
        <Controller
          control={form.control}
          name="cadence"
          render={({ field, fieldState }) => (
            <>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2">
                {CADENCES.map((c) => (
                  <Tile key={c.value} selected={field.value === c.value} onClick={() => field.onChange(c.value)}>
                    {c.label}
                  </Tile>
                ))}
              </div>
              {fieldState.error && <Err>{fieldState.error.message}</Err>}
            </>
          )}
        />
      </div>
      <div>
        <Label htmlFor="first_date">First delivery / event date</Label>
        <Input id="first_date" type="date" className="mt-1 max-w-xs" {...form.register('first_date')} />
        {form.formState.errors.first_date && <Err>{form.formState.errors.first_date.message}</Err>}
      </div>
    </div>
  )
}

function BudgetStep({ form }: { form: ReturnType<typeof useForm<B2BValues>> }) {
  return (
    <div className="space-y-6">
      <div>
        <Label className="text-base">Budget band</Label>
        <Controller
          control={form.control}
          name="budget"
          render={({ field, fieldState }) => (
            <>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {BUDGETS.map((b) => (
                  <Tile key={b.value} selected={field.value === b.value} onClick={() => field.onChange(b.value)}>
                    {b.label}
                  </Tile>
                ))}
              </div>
              {fieldState.error && <Err>{fieldState.error.message}</Err>}
            </>
          )}
        />
      </div>
      <div>
        <Label className="text-base">Dietary needs (multi-select)</Label>
        <Controller
          control={form.control}
          name="dietary"
          render={({ field }) => (
            <div className="mt-3 flex flex-wrap gap-2">
              {DIETARY_NEEDS.map((d) => {
                const active = field.value.includes(d.value)
                return (
                  <button
                    type="button"
                    key={d.value}
                    onClick={() =>
                      field.onChange(
                        active ? field.value.filter((v) => v !== d.value) : [...field.value, d.value],
                      )
                    }
                    className={cn(
                      'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                      active
                        ? 'bg-sky text-white border-sky'
                        : 'bg-bakery text-cocoa-900 border-cocoa-700/20 hover:bg-cream-100',
                    )}
                  >
                    {d.label}
                  </button>
                )
              })}
            </div>
          )}
        />
      </div>
    </div>
  )
}

function ContactStep({ form }: { form: ReturnType<typeof useForm<B2BValues>> }) {
  return (
    <div className="space-y-5">
      <div>
        <Label htmlFor="company">Company</Label>
        <Input id="company" className="mt-1" {...form.register('company')} />
        {form.formState.errors.company && <Err>{form.formState.errors.company.message}</Err>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="contact_name">Your name</Label>
          <Input id="contact_name" className="mt-1" {...form.register('contact_name')} />
          {form.formState.errors.contact_name && <Err>{form.formState.errors.contact_name.message}</Err>}
        </div>
        <div>
          <Label htmlFor="contact_email">Work email</Label>
          <Input
            id="contact_email"
            type="email"
            placeholder="you@company.com"
            className="mt-1"
            {...form.register('contact_email')}
          />
          {form.formState.errors.contact_email && <Err>{form.formState.errors.contact_email.message}</Err>}
        </div>
      </div>
      <div>
        <Label htmlFor="contact_phone">Phone (optional)</Label>
        <Input id="contact_phone" className="mt-1 max-w-xs" {...form.register('contact_phone')} />
      </div>
      <div>
        <Label htmlFor="notes">What should we know?</Label>
        <Textarea
          id="notes"
          placeholder="Tell us about the team, the moment, the brand, the constraints — whatever helps us put together a smart proposal."
          maxLength={800}
          className="mt-1"
          {...form.register('notes')}
        />
      </div>
    </div>
  )
}

function ReviewStep({ form }: { form: ReturnType<typeof useForm<B2BValues>> }) {
  const v = form.getValues()
  const summary = formatB2BSpec(v)
  return (
    <div>
      <p className="text-sm text-cocoa-900/70">
        Looks good? We'll forward this to Askhat. Expect a reply within one business day with a
        proposal — pricing, delivery, and a short sample tasting plan if it makes sense.
      </p>
      <div className="mt-5 bakery-card p-5 border-l-4 border-sky">
        <div className="flex items-start gap-3">
          <Building2 className="h-5 w-5 text-sky mt-0.5" />
          <div className="text-sm text-cocoa-900/80">
            We work primarily with companies in the Sugar Land + Houston metro. If you're outside
            this area, mention it in the notes — we're flexible for the right fit.
          </div>
        </div>
      </div>
      <pre className="mt-5 whitespace-pre-wrap text-sm bg-cream-100 border border-cocoa-700/10 rounded-2xl p-5 font-mono text-cocoa-900">
        {summary}
      </pre>
    </div>
  )
}

function Tile({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-11 rounded-full border text-sm font-medium transition-all px-4',
        selected
          ? 'border-sky bg-sky text-white'
          : 'border-cocoa-700/20 bg-bakery text-cocoa-900 hover:bg-cream-100',
      )}
    >
      {children}
    </button>
  )
}

function Err({ children }: { children?: React.ReactNode }) {
  if (!children) return null
  return <p className="mt-2 text-xs text-berry">{children}</p>
}

function defaultDate() {
  const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}
