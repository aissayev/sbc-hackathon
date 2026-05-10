'use client'

import * as React from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Sparkles,
  ShoppingBag,
  Image as ImageIcon,
  Paperclip,
  X,
} from 'lucide-react'

import {
  customCakeSchema,
  type CustomCakeValues,
  OCCASIONS,
  SERVINGS,
  FLAVORS,
  DIETARY_TAGS,
  formatCustomSpec,
  flavorToSku,
} from '@/lib/custom-cake'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type StepKey = 'about' | 'flavor' | 'when' | 'contact' | 'review'

interface ReferencePhoto {
  id: string
  name: string
  sizeKb: number
  type: string
  previewUrl: string
  file: File
}

interface UploadedFile {
  url: string
  name: string
  size: number
  type: string
}

const REF_MAX_PHOTOS = 5
const REF_MAX_FILE_KB = 8 * 1024

// Backend's /api/uploads is single-file (DO Spaces); loop on the client.
async function uploadReferencePhotos(items: ReferencePhoto[]): Promise<UploadedFile[]> {
  if (items.length === 0) return []
  const out: UploadedFile[] = []
  for (const a of items) {
    const fd = new FormData()
    fd.append('file', a.file, a.name)
    fd.append('scope', 'order')
    const res = await fetch('/api/uploads', { method: 'POST', body: fd })
    const ct = res.headers.get('content-type') ?? ''
    if (!ct.toLowerCase().includes('application/json')) {
      throw new Error('Upload service is offline — try again or chat with us.')
    }
    const data = (await res.json()) as { ok?: boolean; url?: string; type?: string; bytes?: number; reason?: string; error?: string }
    if (!res.ok || !data.ok || !data.url) {
      throw new Error(data.reason ?? data.error ?? `Upload failed (${res.status})`)
    }
    out.push({ url: data.url, name: a.name, size: data.bytes ?? a.file.size, type: data.type ?? a.type })
  }
  return out
}

const STEPS: Array<{ key: StepKey; label: string; subtitle: string }> = [
  { key: 'about', label: 'About the cake', subtitle: 'What is it for, and how many people?' },
  { key: 'flavor', label: 'Flavor & decoration', subtitle: 'Tell us what it should taste like and look like.' },
  { key: 'when', label: 'When + where', subtitle: 'Date, time, and pickup or delivery.' },
  { key: 'contact', label: 'How to reach you', subtitle: 'Final step — Askhat will confirm by phone.' },
  { key: 'review', label: 'Review & send', subtitle: 'Quick scan before we ping the kitchen.' },
]

const STEP_FIELDS: Record<StepKey, (keyof CustomCakeValues)[]> = {
  about: ['occasion', 'servings'],
  flavor: ['flavor', 'color_theme', 'inscription', 'dietary_tags'],
  when: ['scheduled_at_iso', 'pickup_or_delivery'],
  contact: ['customer_name', 'customer_phone', 'customer_email', 'notes'],
  review: [],
}

export function CustomCakeFunnel() {
  const router = useRouter()
  const [stepIdx, setStepIdx] = React.useState(0)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [photos, setPhotos] = React.useState<ReferencePhoto[]>([])
  const [photoError, setPhotoError] = React.useState<string | null>(null)

  React.useEffect(() => {
    return () => {
      photos.forEach((p) => URL.revokeObjectURL(p.previewUrl))
    }
    // cleanup on unmount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function addPhotos(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setPhotoError(null)
    const next: ReferencePhoto[] = [...photos]
    for (const file of Array.from(fileList)) {
      if (next.length >= REF_MAX_PHOTOS) {
        setPhotoError(`Up to ${REF_MAX_PHOTOS} reference photos.`)
        break
      }
      if (!file.type.startsWith('image/')) {
        setPhotoError(`"${file.name}" — only images.`)
        continue
      }
      const sizeKb = Math.round(file.size / 1024)
      if (sizeKb > REF_MAX_FILE_KB) {
        setPhotoError(`"${file.name}" is over 8 MB.`)
        continue
      }
      next.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        sizeKb,
        type: file.type,
        previewUrl: URL.createObjectURL(file),
        file,
      })
    }
    setPhotos(next)
  }

  function removePhoto(id: string) {
    setPhotos((cur) => {
      const target = cur.find((p) => p.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return cur.filter((p) => p.id !== id)
    })
  }

  const form = useForm<CustomCakeValues>({
    resolver: zodResolver(customCakeSchema),
    mode: 'onChange',
    defaultValues: {
      occasion: '',
      servings: '',
      flavor: '',
      color_theme: '',
      inscription: '',
      dietary_tags: [],
      reference_photo_urls: [],
      scheduled_at_iso: defaultPickupTime(),
      pickup_or_delivery: 'pickup',
      customer_name: '',
      customer_phone: '',
      customer_email: '',
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
    setSubmitting(true)
    setError(null)
    try {
      let uploaded: UploadedFile[] = []
      if (photos.length > 0) {
        try {
          uploaded = await uploadReferencePhotos(photos)
        } catch (err) {
          setError((err as Error).message || 'Photo upload failed.')
          return
        }
      }
      const photoUrls = uploaded.map((f) => {
        return f.url.startsWith('http') ? f.url : `${window.location.origin}${f.url}`
      })
      // Persist URLs back into the form so the formatted summary includes them.
      form.setValue('reference_photo_urls', photoUrls)
      const values = { ...form.getValues(), reference_photo_urls: photoUrls }
      const { getReferral } = await import('@/lib/referral')
      const ref = getReferral()
      const payload = {
        contact: values.customer_phone || values.customer_email || values.customer_name,
        meta: {
          customer_name: values.customer_name,
          customer_phone: values.customer_phone,
          customer_email: values.customer_email,
          flavor: values.flavor,
          base_sku: flavorToSku(values.flavor),
          scheduled_at_iso: new Date(values.scheduled_at_iso).toISOString(),
          pickup_or_delivery: values.pickup_or_delivery,
          notes: values.notes,
          reference_photo_urls: photoUrls,
          formatted: formatCustomSpec(values),
          ...(ref ? { referral_source: ref } : {}),
        },
      }
      const res = await fetch('/api/leads/custom-cake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const ct = res.headers.get('content-type') ?? ''
      if (!ct.toLowerCase().includes('application/json')) {
        setError('Couldn\'t reach the kitchen system. Try again in a minute, or chat with us.')
        return
      }
      const data = (await res.json()) as { ok?: boolean; lead_id?: string; reason?: string; error?: string }
      if (!data.ok || !data.lead_id) {
        setError(data.reason ?? data.error ?? 'Something hiccupped on our side. Try again, or chat with us.')
        return
      }
      router.push(`/order/confirm/${data.lead_id}`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div>
        <ProgressRail stepIdx={stepIdx} />

        <div className="mt-8">
          <h2 className="display-h2">{step.label}</h2>
          <p className="mt-1 text-cocoa-900/70">{step.subtitle}</p>
        </div>

        <div className="mt-8 animate-fade-in">
          {step.key === 'about' && <AboutStep form={form} />}
          {step.key === 'flavor' && (
            <FlavorStep
              form={form}
              photos={photos}
              photoError={photoError}
              addPhotos={addPhotos}
              removePhoto={removePhoto}
            />
          )}
          {step.key === 'when' && <WhenStep form={form} />}
          {step.key === 'contact' && <ContactStep form={form} />}
          {step.key === 'review' && <ReviewStep form={form} photos={photos} />}
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
            className="min-w-[180px]"
          >
            {isLast ? (
              <>
                <ShoppingBag /> {submitting ? 'Sending…' : 'Send to kitchen'}
              </>
            ) : (
              <>
                Next <ArrowRight />
              </>
            )}
          </Button>
        </div>
      </div>

      <SummaryAside form={form} photoCount={photos.length} />
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
                className={cn(
                  'h-0.5 flex-1 transition-colors',
                  i < stepIdx ? 'bg-sky' : 'bg-cream-200',
                )}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}

function AboutStep({ form }: { form: ReturnType<typeof useForm<CustomCakeValues>> }) {
  return (
    <div className="space-y-8">
      <div>
        <Label className="text-base">What's the occasion?</Label>
        <Controller
          control={form.control}
          name="occasion"
          render={({ field, fieldState }) => (
            <>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {OCCASIONS.map((o) => (
                  <Tile
                    key={o.value}
                    selected={field.value === o.value}
                    onClick={() => field.onChange(o.value)}
                  >
                    <span className="text-2xl block">{o.icon}</span>
                    <span className="text-sm font-medium mt-2 block">{o.label}</span>
                  </Tile>
                ))}
              </div>
              {fieldState.error && <Err>{fieldState.error.message}</Err>}
            </>
          )}
        />
      </div>

      <div>
        <Label className="text-base">How many guests?</Label>
        <Controller
          control={form.control}
          name="servings"
          render={({ field, fieldState }) => (
            <>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-3">
                {SERVINGS.map((s) => (
                  <Tile
                    key={s.value}
                    selected={field.value === s.value}
                    onClick={() => field.onChange(s.value)}
                  >
                    <span className="font-display text-xl text-cocoa-900 block">{s.label}</span>
                    <span className="text-xs text-cocoa-900/60 mt-1 block">{s.subtitle}</span>
                  </Tile>
                ))}
              </div>
              {fieldState.error && <Err>{fieldState.error.message}</Err>}
            </>
          )}
        />
      </div>
    </div>
  )
}

function FlavorStep({
  form,
  photos,
  photoError,
  addPhotos,
  removePhoto,
}: {
  form: ReturnType<typeof useForm<CustomCakeValues>>
  photos: ReferencePhoto[]
  photoError: string | null
  addPhotos: (files: FileList | null) => void
  removePhoto: (id: string) => void
}) {
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  return (
    <div className="space-y-8">
      <div>
        <Label className="text-base">Flavor base</Label>
        <Controller
          control={form.control}
          name="flavor"
          render={({ field, fieldState }) => (
            <>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {FLAVORS.map((f) => (
                  <Tile
                    key={f.value}
                    selected={field.value === f.value}
                    onClick={() => field.onChange(f.value)}
                  >
                    <span className="text-sm font-medium block">{f.label}</span>
                  </Tile>
                ))}
              </div>
              {fieldState.error && <Err>{fieldState.error.message}</Err>}
            </>
          )}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="color_theme">Color theme</Label>
          <Input
            id="color_theme"
            placeholder="Soft pink + gold"
            className="mt-1"
            {...form.register('color_theme')}
          />
        </div>
        <div>
          <Label htmlFor="inscription">Inscription on top (optional)</Label>
          <Input
            id="inscription"
            placeholder="Happy 30th, Maya"
            maxLength={50}
            className="mt-1"
            {...form.register('inscription')}
          />
          <p className="mt-1 text-xs text-cocoa-900/55">Up to 50 characters fits cleanly.</p>
        </div>
      </div>

      <div>
        <Label className="text-base">Dietary needs</Label>
        <Controller
          control={form.control}
          name="dietary_tags"
          render={({ field }) => (
            <div className="mt-3 flex flex-wrap gap-2">
              {DIETARY_TAGS.map((t) => {
                const active = field.value.includes(t.value)
                return (
                  <button
                    type="button"
                    key={t.value}
                    onClick={() =>
                      field.onChange(
                        active ? field.value.filter((v) => v !== t.value) : [...field.value, t.value],
                      )
                    }
                    className={cn(
                      'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                      active
                        ? 'bg-sky text-white border-sky'
                        : 'bg-bakery text-cocoa-900 border-cocoa-700/20 hover:bg-cream-100',
                    )}
                  >
                    {t.label}
                  </button>
                )
              })}
            </div>
          )}
        />
      </div>

      <div>
        <Label className="text-base">Reference photos (optional)</Label>
        <p className="mt-1 text-sm text-cocoa-900/65">
          A photo of a cake you love, a sketch, an inspo image — anything that helps Askhat picture
          what you have in mind. Up to 5 images, 8 MB each.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => addPhotos(e.target.files)}
          className="sr-only"
        />
        <div className="mt-4 flex flex-wrap items-start gap-3">
          {photos.map((p) => (
            <div
              key={p.id}
              className="relative group h-24 w-24 rounded-xl overflow-hidden border border-cocoa-700/15 bg-cream-100"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.previewUrl} alt={p.name} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(p.id)}
                aria-label={`Remove ${p.name}`}
                className="absolute top-1 right-1 h-6 w-6 inline-flex items-center justify-center rounded-full bg-cocoa-900/70 text-cream hover:bg-cocoa-900"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {photos.length < REF_MAX_PHOTOS && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-24 w-24 rounded-xl border-2 border-dashed border-cocoa-700/25 bg-bakery hover:bg-cream-100 hover:border-sky transition-colors flex flex-col items-center justify-center gap-1 text-cocoa-900/65 hover:text-sky-700"
            >
              <Paperclip className="h-5 w-5" />
              <span className="text-[11px] font-medium">Add photo</span>
            </button>
          )}
        </div>
        {photoError && (
          <p className="mt-2 text-xs text-berry" role="alert">
            {photoError}
          </p>
        )}
      </div>
    </div>
  )
}

function WhenStep({ form }: { form: ReturnType<typeof useForm<CustomCakeValues>> }) {
  const minWhen = React.useMemo(() => toLocalDatetimeValue(new Date(Date.now() + 24 * 60 * 60 * 1000)), [])
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="scheduled_at_iso">Pickup / delivery time</Label>
          <Input
            id="scheduled_at_iso"
            type="datetime-local"
            min={minWhen}
            className="mt-1"
            {...form.register('scheduled_at_iso')}
          />
          {form.formState.errors.scheduled_at_iso && (
            <Err>{form.formState.errors.scheduled_at_iso.message}</Err>
          )}
          <p className="mt-1 text-xs text-cocoa-900/55">
            Custom cakes need 24 hours minimum (36 hours for vegan or gluten-free).
          </p>
        </div>
        <div>
          <Label>How would you like it?</Label>
          <Controller
            control={form.control}
            name="pickup_or_delivery"
            render={({ field }) => (
              <div className="mt-1 grid grid-cols-2 gap-2">
                {(['pickup', 'delivery'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => field.onChange(mode)}
                    className={cn(
                      'h-11 rounded-full border text-sm font-medium capitalize transition-colors',
                      field.value === mode
                        ? 'border-cocoa-700 bg-cocoa-700 text-cream'
                        : 'border-cocoa-700/20 bg-bakery text-cocoa-900 hover:bg-cream-100',
                    )}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            )}
          />
          <p className="mt-1 text-xs text-cocoa-900/55">
            Pickup is free. Delivery fee confirmed at order time.
          </p>
        </div>
      </div>
    </div>
  )
}

function ContactStep({ form }: { form: ReturnType<typeof useForm<CustomCakeValues>> }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="customer_name">Your name</Label>
          <Input id="customer_name" className="mt-1" {...form.register('customer_name')} />
          {form.formState.errors.customer_name && <Err>{form.formState.errors.customer_name.message}</Err>}
        </div>
        <div>
          <Label htmlFor="customer_phone">Phone</Label>
          <Input
            id="customer_phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+1 281 555 1234"
            className="mt-1"
            {...form.register('customer_phone', {
              // Strip disallowed chars on the way in so users can paste
              // formatted numbers but can't sneak in letters.
              setValueAs: (v: string) =>
                typeof v === 'string' ? v.replace(/[^+()\d\s\-.]/g, '') : v,
            })}
          />
          {form.formState.errors.customer_phone && <Err>{form.formState.errors.customer_phone.message}</Err>}
        </div>
      </div>
      <div>
        <Label htmlFor="customer_email">Email (optional)</Label>
        <Input
          id="customer_email"
          type="email"
          placeholder="you@example.com"
          className="mt-1"
          {...form.register('customer_email')}
        />
        {form.formState.errors.customer_email && <Err>{form.formState.errors.customer_email.message}</Err>}
      </div>
      <div>
        <Label htmlFor="notes">Anything else we should know?</Label>
        <Textarea
          id="notes"
          placeholder="Photo print on top, side door pickup, allergies — anything that helps."
          maxLength={500}
          className="mt-1"
          {...form.register('notes')}
        />
      </div>
    </div>
  )
}

function ReviewStep({
  form,
  photos,
}: {
  form: ReturnType<typeof useForm<CustomCakeValues>>
  photos: ReferencePhoto[]
}) {
  const v = form.getValues()
  const summary = formatCustomSpec(v)
  return (
    <div>
      <p className="text-sm text-cocoa-900/70">
        Looks good? Send it to Askhat. He&apos;ll confirm by phone within an hour during open hours
        and give you the final price after he sees the design.
      </p>
      {photos.length > 0 && (
        <div className="mt-5">
          <Label className="text-sm">Reference photos ({photos.length})</Label>
          <ul className="mt-2 flex flex-wrap gap-3">
            {photos.map((p) => (
              <li key={p.id} className="h-20 w-20 rounded-lg overflow-hidden border border-cocoa-700/15">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.previewUrl} alt={p.name} className="h-full w-full object-cover" />
              </li>
            ))}
          </ul>
        </div>
      )}
      <pre className="mt-5 whitespace-pre-wrap text-sm bg-cream-100 border border-cocoa-700/10 rounded-2xl p-5 font-mono text-cocoa-900">
        {summary}
      </pre>
    </div>
  )
}

function SummaryAside({
  form,
  photoCount,
}: {
  form: ReturnType<typeof useForm<CustomCakeValues>>
  photoCount: number
}) {
  const v = form.watch()
  return (
    <aside className="lg:sticky lg:top-28 self-start bakery-card p-6 bg-cream-100">
      <p className="eyebrow">Your custom cake</p>
      <div className="mt-4 space-y-3 text-sm">
        <Row label="Occasion" value={v.occasion ? labelOf(OCCASIONS, v.occasion) : undefined} />
        <Row label="Servings" value={v.servings ? labelOf(SERVINGS, v.servings) : undefined} />
        <Row label="Flavor" value={v.flavor ? labelOf(FLAVORS, v.flavor) : undefined} />
        {v.color_theme && <Row label="Color" value={v.color_theme} />}
        {v.inscription && <Row label="Inscription" value={`"${v.inscription}"`} />}
        {photoCount > 0 && (
          <Row
            label="Photos"
            value={`${photoCount} reference${photoCount === 1 ? '' : 's'}`}
          />
        )}
        {v.dietary_tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {v.dietary_tags.map((t) => (
              <Badge key={t} variant="sky" className="text-[11px]">
                {labelOf(DIETARY_TAGS, t)}
              </Badge>
            ))}
          </div>
        )}
      </div>
      <div className="mt-6 pt-5 border-t border-cocoa-700/10 text-xs text-cocoa-900/65 leading-relaxed">
        <Sparkles className="inline h-3.5 w-3.5 text-sky mr-1.5" />
        Custom cakes are quoted by the owner — final price is set after he sees the design and
        sources the ingredients. Typically <strong>$60–$180</strong> for the sizes here.
      </div>
    </aside>
  )
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-cocoa-900/55 text-xs uppercase tracking-[0.14em]">{label}</span>
      <span className="text-cocoa-900 font-medium text-right">{value || <span className="text-cocoa-900/30">—</span>}</span>
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
        'rounded-2xl border p-4 text-center transition-all',
        selected
          ? 'border-sky bg-sky/5 shadow-ring'
          : 'border-cocoa-700/15 bg-bakery hover:bg-cream-100',
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

function defaultPickupTime() {
  const d = new Date(Date.now() + 26 * 60 * 60 * 1000)
  d.setMinutes(0, 0, 0)
  return toLocalDatetimeValue(d)
}

function toLocalDatetimeValue(d: Date) {
  const off = d.getTimezoneOffset()
  const local = new Date(d.getTime() - off * 60 * 1000)
  return local.toISOString().slice(0, 16)
}

function labelOf<T extends ReadonlyArray<{ value: string; label: string }>>(arr: T, value: string): string {
  return arr.find((x) => x.value === value)?.label ?? value
}
