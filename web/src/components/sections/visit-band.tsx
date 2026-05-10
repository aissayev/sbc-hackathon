import Image from 'next/image'
import { MapPin, Phone, Mail, Instagram, Clock } from 'lucide-react'
import { BRAND, ASSETS } from '@/lib/brand'
import { Eyebrow } from '@/components/brand/eyebrow'
import { Button } from '@/components/ui/button'
import { HoursTable, isOpenNow } from '@/components/brand/hours'

// Replaces the previous 2-card-with-banner-on-top layout that left the
// location card half-empty and stacked too many CTAs (Get directions /
// phone pill / Instagram pill) without a clear primary action.
//
// New layout (desktop):
//   ┌──────────────────────────┬────────────────────────┐
//   │  HOURS                   │                        │
//   │  When to visit           │       PHOTO            │
//   │  open-now status pill    │  (signOverTable shot)  │
//   │  hours table             │   tall portrait crop   │
//   ├──────────────────────────┤                        │
//   │  ADDRESS                 │                        │
//   │  Where to find us        │                        │
//   │  street + parking + map  │                        │
//   │  inline phone + email    │                        │
//   └──────────────────────────┴────────────────────────┘
//
// One primary CTA (Get directions, sky), phone + email as quiet inline
// links (no pills), Instagram dropped (it's already in the footer's
// brand block — was duplicate noise here).

export function VisitBand() {
  const status = isOpenNow()
  return (
    <section className="container mt-28 md:mt-32" id="visit" aria-labelledby="visit-heading">
      <div className="max-w-3xl">
        <Eyebrow>Visit + delivery</Eyebrow>
        <h2 id="visit-heading" className="display-h2 mt-3 [text-wrap:balance]">
          <span className="text-sky">Come see us.</span> Or we&apos;ll deliver.
        </h2>
        <p className="mt-3 text-cocoa-900/70 max-w-xl">
          Free delivery in Sugar Land. Greater Houston for a small fee — confirmed at order.
        </p>
      </div>

      <div className="mt-10 grid gap-5 lg:grid-cols-[1fr_minmax(360px,1fr)]">
        <div className="grid gap-5 sm:grid-rows-[auto_1fr]">
          <div className="bakery-card p-6 md:p-8">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] font-medium text-cocoa-900/55">
                <Clock className="h-3.5 w-3.5" /> Hours
              </div>
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
                  status.open ? 'bg-emerald-100 text-emerald-800' : 'bg-cream-200 text-cocoa-900/70'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    status.open ? 'bg-emerald-600 animate-pulse' : 'bg-cocoa-700/40'
                  }`}
                  aria-hidden
                />
                {status.open ? 'Open now' : 'Closed'} · {status.nextChange}
              </span>
            </div>
            <HoursTable className="mt-5" />
          </div>

          <div className="bakery-card p-6 md:p-8 flex flex-col">
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] font-medium text-cocoa-900/55">
              <MapPin className="h-3.5 w-3.5" /> Where to find us
            </div>
            <p className="mt-4 text-cocoa-900 text-lg leading-snug">
              {BRAND.address.line1}
              <br />
              {BRAND.address.city}, {BRAND.address.region} {BRAND.address.postalCode}
            </p>
            <p className="mt-2 text-sm text-cocoa-900/60">{BRAND.address.parkingNote}</p>
            <div className="mt-5">
              <Button asChild variant="sky">
                <a href={BRAND.mapsUrl} target="_blank" rel="noopener">
                  <MapPin /> Get directions
                </a>
              </Button>
            </div>
            <ul className="mt-5 grid gap-2 text-sm text-cocoa-900/80">
              <li>
                <a href={BRAND.phone.hrefTel} className="inline-flex items-center gap-2 hover:text-cocoa-900">
                  <Phone className="h-4 w-4 text-cocoa-900/55" /> {BRAND.phone.display}
                </a>
              </li>
              <li>
                <a href={`mailto:${BRAND.email}`} className="inline-flex items-center gap-2 hover:text-cocoa-900">
                  <Mail className="h-4 w-4 text-cocoa-900/55" /> {BRAND.email}
                </a>
              </li>
              <li>
                <a
                  href={BRAND.instagram}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-2 hover:text-cocoa-900"
                >
                  <Instagram className="h-4 w-4 text-cocoa-900/55" /> {BRAND.instagramHandle}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Photo column — taller portrait crop on desktop, becomes a wide
            banner above the cards on mobile via the grid reordering. */}
        <div className="relative overflow-hidden rounded-[28px] bg-cream-100 aspect-[4/5] sm:aspect-[16/9] lg:aspect-auto lg:min-h-full order-first lg:order-last">
          <Image
            src={ASSETS.store.signOverTable}
            alt="Inside Happy Cake on Promenade Way — the long blue-chair table under our neon sign"
            fill
            sizes="(min-width: 1024px) 600px, 100vw"
            className="object-cover"
          />
        </div>
      </div>
    </section>
  )
}
