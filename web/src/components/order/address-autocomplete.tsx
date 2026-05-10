'use client'

import * as React from 'react'
import { Loader2, MapPin } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

// Address autocomplete with two paths:
//
// 1. Google Places (Stripe / Shopify-grade) — when NEXT_PUBLIC_GOOGLE_MAPS_KEY
//    is set, the Places JS SDK loads on first focus and powers a real
//    address picker (street → city → state → zip pre-filled in one tap).
// 2. ZIP-aware fallback — when no key is present we still help: typing a
//    valid US ZIP into the ZIP field calls the free zippopotam.us API and
//    auto-fills city + state. The street field stays a normal input.
//
// Either way the parent owns the form state and validation; this is just
// the input layer.

interface AddressValue {
  street: string
  city: string
  state: string
  zip: string
}

interface Props {
  value: AddressValue
  onChange: (next: AddressValue) => void
  errors?: Partial<Record<keyof AddressValue, string | undefined>>
  /** Optional list of city names for the city <datalist> when Places isn't available. */
  cityHints?: ReadonlyArray<string>
  /** Country code (ISO 2-letter) restriction passed to Places. Defaults to 'us'. */
  country?: string
  /** Names for nested form fields, useful for autocomplete browser hints. */
  nameStreet?: string
  nameCity?: string
  nameState?: string
  nameZip?: string
}

export function AddressAutocomplete({
  value,
  onChange,
  errors,
  cityHints,
  country = 'us',
  nameStreet = 'street',
  nameCity = 'city',
  nameState = 'state',
  nameZip = 'zip',
}: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? ''
  const usePlaces = apiKey.length > 0
  const streetRef = React.useRef<HTMLInputElement>(null)
  const [placesReady, setPlacesReady] = React.useState(false)
  const [zipLookupBusy, setZipLookupBusy] = React.useState(false)

  // Lazy-load the Places SDK on first focus so visitors who never start
  // an order don't pay the script cost. Using `places` library only.
  const ensurePlacesLoaded = React.useCallback(async () => {
    if (!usePlaces) return false
    if (typeof window === 'undefined') return false
    type WindowWithPlaces = Window & {
      google?: { maps?: { places?: { Autocomplete: unknown } } }
      __hcPlacesLoading?: Promise<void>
    }
    const w = window as WindowWithPlaces
    if (w.google?.maps?.places) return true
    if (!w.__hcPlacesLoading) {
      w.__hcPlacesLoading = new Promise<void>((resolve, reject) => {
        const existing = document.getElementById('hc-google-maps')
        if (existing) {
          existing.addEventListener('load', () => resolve(), { once: true })
          existing.addEventListener('error', () => reject(new Error('places-load-failed')), { once: true })
          return
        }
        const script = document.createElement('script')
        script.id = 'hc-google-maps'
        script.async = true
        script.defer = true
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
          apiKey,
        )}&libraries=places&loading=async&v=weekly`
        script.addEventListener('load', () => resolve(), { once: true })
        script.addEventListener('error', () => reject(new Error('places-load-failed')), { once: true })
        document.head.appendChild(script)
      })
    }
    try {
      await w.__hcPlacesLoading
      return Boolean(w.google?.maps?.places)
    } catch {
      return false
    }
  }, [apiKey, usePlaces])

  // Wire the legacy `Autocomplete` widget — it's still the most reliable
  // way to bind a single text input to address suggestions without the
  // newer Place class's session-token bookkeeping.
  React.useEffect(() => {
    if (!usePlaces) return
    const el = streetRef.current
    if (!el) return

    let autocompleteInstance: unknown = null
    let listener: unknown = null

    const onFocusOnce = async () => {
      el.removeEventListener('focus', onFocusOnce)
      const ok = await ensurePlacesLoaded()
      if (!ok) return
      type Places = {
        Autocomplete: new (
          input: HTMLInputElement,
          opts: Record<string, unknown>,
        ) => {
          getPlace: () => {
            address_components?: Array<{ long_name: string; short_name: string; types: string[] }>
          }
          addListener: (event: string, cb: () => void) => unknown
        }
      }
      const placesNs = (window as unknown as {
        google: { maps: { places: Places; event: { removeListener: (l: unknown) => void } } }
      }).google.maps.places
      const ac = new placesNs.Autocomplete(el, {
        types: ['address'],
        componentRestrictions: { country },
        fields: ['address_components', 'formatted_address'],
      })
      autocompleteInstance = ac
      listener = ac.addListener('place_changed', () => {
        const place = ac.getPlace()
        const next = parsePlaceComponents(place.address_components ?? [])
        if (next) onChange({ ...value, ...next })
      })
      setPlacesReady(true)
    }
    el.addEventListener('focus', onFocusOnce, { once: true })
    return () => {
      el.removeEventListener('focus', onFocusOnce)
      try {
        type GMaps = { event: { removeListener: (l: unknown) => void } }
        const g = (window as unknown as { google?: { maps?: GMaps } }).google
        if (listener && g?.maps?.event) g.maps.event.removeListener(listener)
      } catch {}
      autocompleteInstance = null
    }
    // value/onChange intentionally excluded — we only want to wire once per element.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, ensurePlacesLoaded, usePlaces])

  // ZIP-based fallback: when the user types a 5-digit ZIP and Places
  // hasn't already overridden the address, hit the free zippopotam.us
  // API to fill in city + state. We track which ZIP the autofill last
  // ran for, so manual edits to city/state stick — re-running only
  // when the user actually changes the ZIP. Stripe-style behavior.
  const lastAutofilledZip = React.useRef<string>('')
  React.useEffect(() => {
    if (placesReady) return
    const zipDigits = value.zip.replace(/\D/g, '')
    if (zipDigits.length !== 5) return
    if (lastAutofilledZip.current === zipDigits) return
    let cancelled = false
    setZipLookupBusy(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`https://api.zippopotam.us/us/${zipDigits}`)
        if (!res.ok) return
        const data = (await res.json()) as {
          places?: Array<{ 'place name'?: string; 'state abbreviation'?: string }>
        }
        const first = data.places?.[0]
        if (cancelled || !first) return
        lastAutofilledZip.current = zipDigits
        onChange({
          ...value,
          city: first['place name'] ?? value.city,
          state: first['state abbreviation'] ?? value.state,
        })
      } catch {
        // network blocked / offline — silently no-op
      } finally {
        if (!cancelled) setZipLookupBusy(false)
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
      setZipLookupBusy(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.zip, placesReady])

  return (
    <div className="grid gap-4 sm:grid-cols-[2fr_1fr_auto_auto]">
      <div className="sm:col-span-4">
        <Label htmlFor={nameStreet} className="flex items-center gap-1.5">
          Street address
          {usePlaces && (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky/10 text-sky-700 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
              <MapPin className="h-2.5 w-2.5" />
              Autocomplete
            </span>
          )}
        </Label>
        <Input
          id={nameStreet}
          ref={streetRef}
          name={nameStreet}
          autoComplete="address-line1"
          placeholder="123 Main St"
          value={value.street}
          onChange={(e) => onChange({ ...value, street: e.target.value })}
          className="mt-1"
        />
        {errors?.street && <p className="mt-1 text-xs text-berry">{errors.street}</p>}
      </div>

      <div className="sm:col-span-2">
        <Label htmlFor={nameCity}>City</Label>
        <Input
          id={nameCity}
          name={nameCity}
          autoComplete="address-level2"
          list={cityHints && cityHints.length ? 'hc-delivery-cities' : undefined}
          value={value.city}
          onChange={(e) => onChange({ ...value, city: e.target.value })}
          className="mt-1"
        />
        {cityHints && (
          <datalist id="hc-delivery-cities">
            {cityHints.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        )}
        {errors?.city && <p className="mt-1 text-xs text-berry">{errors.city}</p>}
      </div>

      <div>
        <Label htmlFor={nameState}>State</Label>
        <select
          id={nameState}
          name={nameState}
          autoComplete="address-level1"
          value={value.state}
          onChange={(e) => onChange({ ...value, state: e.target.value.toUpperCase() })}
          className={cn(
            'mt-1 flex h-11 w-full rounded-lg border border-cocoa-700/15 bg-bakery px-3 pr-8 py-2 text-sm text-ink',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-cream',
          )}
        >
          <option value="">—</option>
          {US_STATES_FOR_PICKER.map((s) => (
            <option key={s.code} value={s.code}>
              {s.code}
            </option>
          ))}
        </select>
        {errors?.state && <p className="mt-1 text-xs text-berry">{errors.state}</p>}
      </div>

      <div>
        <Label htmlFor={nameZip} className="flex items-center gap-1.5">
          ZIP
          {zipLookupBusy && <Loader2 className="h-3 w-3 animate-spin text-cocoa-900/45" />}
        </Label>
        <Input
          id={nameZip}
          name={nameZip}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={5}
          autoComplete="postal-code"
          placeholder="77478"
          value={value.zip}
          onChange={(e) => onChange({ ...value, zip: e.target.value.replace(/[^\d]/g, '').slice(0, 5) })}
          className="mt-1 w-24"
        />
        {errors?.zip && <p className="mt-1 text-xs text-berry">{errors.zip}</p>}
      </div>
    </div>
  )
}

// Pull common address parts out of a Places response into our flat shape.
function parsePlaceComponents(
  components: Array<{ long_name: string; short_name: string; types: string[] }>,
): Partial<AddressValue> | null {
  if (!components.length) return null
  const get = (type: string) => components.find((c) => c.types.includes(type))
  const streetNum = get('street_number')?.long_name ?? ''
  const route = get('route')?.long_name ?? ''
  const city =
    get('locality')?.long_name ??
    get('postal_town')?.long_name ??
    get('sublocality')?.long_name ??
    get('administrative_area_level_2')?.long_name ??
    ''
  const state = get('administrative_area_level_1')?.short_name ?? ''
  const zip = get('postal_code')?.long_name ?? ''
  const street = [streetNum, route].filter(Boolean).join(' ').trim()
  if (!street && !city && !state && !zip) return null
  return { street, city, state, zip }
}

import { US_STATES } from '@/lib/us-states'
const US_STATES_FOR_PICKER = US_STATES
