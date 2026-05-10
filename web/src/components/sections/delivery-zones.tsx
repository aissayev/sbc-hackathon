import Link from 'next/link'
import { Truck, MapPin, MessageSquareHeart, ArrowRight } from 'lucide-react'
import { Eyebrow } from '@/components/brand/eyebrow'
import { DELIVERY_CITIES, HOUSTON_ZIP_PREFIXES } from '@/lib/delivery'

// Visible callout for the delivery footprint. Without this, the only place
// "where do you deliver?" lived was buried in the order form. Customers
// outside the zone need a clear path (chat us for a custom quote) and
// inside-the-zone customers need to *see* they're covered before clicking
// through to order.

const NEAR_FREE = ['Sugar Land', 'Stafford', 'Missouri City', 'Richmond'] as const

export function DeliveryZones() {
  // Cities NOT in the "free near-by" list become the broader Greater
  // Houston tier — same delivery, fee confirmed at order.
  const houstonTier = DELIVERY_CITIES.filter((c) => !NEAR_FREE.includes(c as (typeof NEAR_FREE)[number]))

  return (
    <section className="container mt-24" aria-labelledby="delivery-heading">
      <div className="max-w-3xl">
        <Eyebrow>Pickup or delivery</Eyebrow>
        <h2 id="delivery-heading" className="display-h2 mt-3">
          Free local delivery in Sugar Land. Greater Houston, too.
        </h2>
        <p className="mt-3 text-cocoa-900/75 leading-relaxed">
          Pickup is always free at our shop on Promenade Way. For delivery, we cover the
          immediate neighbourhood at no charge and the wider Greater Houston metro for a small
          fee confirmed at order time.
        </p>
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        <ZoneCard
          tone="sage"
          icon={MapPin}
          eyebrow="Free local"
          title="Sugar Land + neighbours"
          subtitle="Free delivery"
          cities={NEAR_FREE as unknown as readonly string[]}
        />
        <ZoneCard
          tone="sky"
          icon={Truck}
          eyebrow="Greater Houston"
          title="Houston metro · small fee"
          subtitle={`ZIPs starting ${HOUSTON_ZIP_PREFIXES.slice(0, 4).join(', ')}…`}
          cities={houstonTier}
        />
        <Link
          href="/chat"
          className="group bakery-card flex flex-col p-6 bg-berry/5 border-berry/20 hover:-translate-y-0.5 hover:shadow-md transition-all"
        >
          <span className="h-11 w-11 rounded-full bg-berry/15 text-berry inline-flex items-center justify-center">
            <MessageSquareHeart className="h-5 w-5" />
          </span>
          <Eyebrow className="mt-5 text-berry">Outside the zone?</Eyebrow>
          <h3 className="display-h3 mt-2 text-xl leading-tight">
            We&apos;ll quote a custom delivery
          </h3>
          <p className="mt-3 text-sm text-cocoa-900/75 leading-relaxed">
            For weddings, corporate events, and addresses past the metro — message us. We&apos;ve
            sent cakes as far as Galveston and College Station.
          </p>
          <span className="mt-auto pt-5 inline-flex items-center gap-1 text-sm font-medium text-berry group-hover:text-cocoa-900">
            Message us for a quote
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      </div>
    </section>
  )
}

function ZoneCard({
  tone,
  icon: Icon,
  eyebrow,
  title,
  subtitle,
  cities,
}: {
  tone: 'sage' | 'sky'
  icon: typeof Truck
  eyebrow: string
  title: string
  subtitle: string
  cities: readonly string[]
}) {
  const ring = tone === 'sage' ? 'border-sage/40 bg-sage/5' : 'border-sky/30 bg-sky/5'
  const iconWrap = tone === 'sage' ? 'bg-sage/30 text-emerald-700' : 'bg-sky/15 text-sky-700'
  const eyebrowColor = tone === 'sage' ? 'text-emerald-700' : 'text-sky-700'
  const subtitleColor = tone === 'sage' ? 'text-emerald-800' : 'text-sky-800'
  return (
    <div className={`bakery-card flex flex-col p-6 ${ring}`}>
      <span className={`h-11 w-11 rounded-full inline-flex items-center justify-center ${iconWrap}`}>
        <Icon className="h-5 w-5" />
      </span>
      <Eyebrow className={`mt-5 ${eyebrowColor}`}>{eyebrow}</Eyebrow>
      <h3 className="display-h3 mt-2 text-xl leading-tight">{title}</h3>
      <p className={`mt-2 text-sm font-medium ${subtitleColor}`}>{subtitle}</p>
      <ul className="mt-4 flex flex-wrap gap-1.5">
        {cities.map((c) => (
          <li
            key={c}
            className="inline-flex items-center rounded-full bg-cream px-2.5 py-1 text-[11px] text-cocoa-900/80 border border-cocoa-700/10"
          >
            {c}
          </li>
        ))}
      </ul>
    </div>
  )
}
