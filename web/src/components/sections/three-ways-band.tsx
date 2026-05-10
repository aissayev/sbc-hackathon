import Link from 'next/link'
import { Cake, ShoppingBag, Sparkles, ArrowRight, Clock } from 'lucide-react'
import { Eyebrow } from '@/components/brand/eyebrow'

// Replaces the previous DietaryAndCustomBand. Surfaces the three ways a
// customer can buy from us — slices today, a whole cake by the weekend
// (pre-order), or a custom cake (designed with the owner). Pre-orders get
// first-class billing because it's how regulars actually plan around us.
//
// Each card has its own destination, lead-time chip, and CTA. The middle
// card carries the pre-order language the user asked for prominently.

interface PathCard {
  icon: typeof Cake
  eyebrow: string
  title: string
  body: string
  lead: string
  href: string
  cta: string
  accent: 'sage' | 'sky' | 'berry'
  primary?: boolean
}

const PATHS: PathCard[] = [
  {
    icon: ShoppingBag,
    eyebrow: 'By the slice',
    title: 'Drop in for a slice',
    body: "No notice, no plan — what's in the case is what's ready. Grab one with your coffee.",
    lead: 'Ready now',
    href: '/menu',
    cta: "See today's case",
    accent: 'sage',
  },
  {
    icon: Cake,
    eyebrow: 'Pre-order ahead',
    title: 'Whole cake for the weekend',
    body: 'Tell us when you need it. Honey, pistachio roll, cloud cake — pre-order any whole cake by Saturday morning, pick up Sunday.',
    lead: '1h+ notice · pre-order any day',
    href: '/order',
    cta: 'Start a pre-order',
    accent: 'sky',
    primary: true,
  },
  {
    icon: Sparkles,
    eyebrow: 'Custom cake',
    title: 'Designed with you',
    body: 'Birthdays, anniversaries, baby showers. Flavors, fillings, message, photo or fondant — Askhat quotes by phone.',
    lead: '24h notice · 36h vegan/GF',
    href: '/order/custom',
    cta: 'Start the design',
    accent: 'berry',
  },
]

const ACCENT: Record<'sage' | 'sky' | 'berry', { ring: string; chip: string; iconBg: string; iconText: string; cta: string }> = {
  sage: {
    ring: 'border-sage/40',
    chip: 'bg-sage/30 text-emerald-800',
    iconBg: 'bg-sage/30',
    iconText: 'text-emerald-700',
    cta: 'text-emerald-700 hover:text-emerald-900',
  },
  sky: {
    ring: 'border-sky/40 ring-1 ring-sky/20',
    chip: 'bg-sky/15 text-sky-800',
    iconBg: 'bg-sky/15',
    iconText: 'text-sky-700',
    cta: 'text-sky-700 hover:text-sky-900',
  },
  berry: {
    ring: 'border-berry/30',
    chip: 'bg-berry/15 text-berry',
    iconBg: 'bg-berry/15',
    iconText: 'text-berry',
    cta: 'text-berry hover:text-cocoa-900',
  },
}

export function ThreeWaysBand() {
  return (
    <section className="container mt-24" aria-labelledby="three-ways-heading">
      <div className="text-center max-w-2xl mx-auto">
        <Eyebrow>Three ways to order</Eyebrow>
        <h2 id="three-ways-heading" className="display-h2 mt-3">
          Slice today, whole cake by the weekend, or designed with you.
        </h2>
        <p className="mt-3 text-cocoa-900/70">
          Walk in for a slice, pre-order a whole cake for the table, or commission a custom one
          for the occasion — same kitchen, same hands.
        </p>
      </div>
      <div className="mt-10 grid gap-5 md:grid-cols-3 auto-rows-fr">
        {PATHS.map((p) => {
          const a = ACCENT[p.accent]
          const Icon = p.icon
          return (
            <Link
              key={p.title}
              href={p.href}
              className={`group relative bakery-card flex flex-col p-7 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99] ${a.ring}`}
            >
              {p.primary && (
                <span className="absolute -top-3 right-6 inline-flex items-center rounded-full bg-sky text-white text-[10px] font-medium uppercase tracking-[0.16em] px-2.5 py-1 shadow-sm">
                  Most ordered
                </span>
              )}
              <span className={`h-11 w-11 rounded-full ${a.iconBg} ${a.iconText} inline-flex items-center justify-center`}>
                <Icon className="h-5 w-5" />
              </span>
              <Eyebrow className="mt-5">{p.eyebrow}</Eyebrow>
              <h3 className="display-h3 mt-2 text-xl leading-tight">{p.title}</h3>
              <p className="mt-3 text-sm text-cocoa-900/75 leading-relaxed">{p.body}</p>
              <span className={`mt-4 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium self-start ${a.chip}`}>
                <Clock className="h-3 w-3" /> {p.lead}
              </span>
              <span className={`mt-auto pt-5 inline-flex items-center gap-1 text-sm font-medium ${a.cta}`}>
                {p.cta}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
