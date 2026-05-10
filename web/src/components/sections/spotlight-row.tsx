import Link from 'next/link'
import Image from 'next/image'
import { ASSETS } from '@/lib/brand'
import { Button } from '@/components/ui/button'
import { Eyebrow } from '@/components/brand/eyebrow'
import { ArrowRight } from 'lucide-react'

// Sits right after the hero — one bold message, one big photo, one
// primary CTA. The hero says "Cakes worth driving for"; this picks ONE
// cake and shows you why. Inspired by the Tatte spotlight: title, lede,
// large image, single dark button. Brand-aligned: cream background,
// rounded media, Playfair display for the headline, lowercase brand
// voice ("cake \"Honey\"") per the brand book.
//
// Pick is hardcoded to cake "Honey" today — it's the signature, in
// stock, photographed well, and the brand book leads with it. Once the
// admin has a "feature this cake" toggle (or we want to rotate by week),
// this can read from a small server prop.

const PICK = {
  href: '/menu/honey-cake-slice',
  productName: 'cake "Honey"',
  // Eyebrow doubles as time / framing. Keeping it generic ("on the
  // bench right now") so the page doesn't go stale outside Sunday.
  eyebrow: 'On the bench right now',
  headline: 'cake "Honey"',
  subhead: 'Six layers, one recipe, since the day we opened.',
  body:
    'Golden honey biscuit, soft custard between every layer, walnuts on top. Baked from scratch this morning — by the slice from the case, or as a whole cake to take home.',
  primaryCta: { label: 'Order cake "Honey"', href: '/menu/honey-cake-slice' },
  secondaryCta: { label: 'See the full menu', href: '/menu' },
  image: ASSETS.products[3],
  imageAlt:
    'cake "Honey" — six golden honey-biscuit layers with soft custard between each, walnuts on top',
}

export function SpotlightRow() {
  return (
    <section className="container mt-16 md:mt-24 lg:mt-28">
      <div className="rounded-[28px] md:rounded-[36px] bg-cream-100 overflow-hidden">
        <div className="grid lg:grid-cols-12 gap-0 items-stretch">
          {/* Copy column — sits left on desktop, beneath image on mobile.
              Generous padding so the headline really gets to breathe;
              the brand book asks for whitespace and this is the place
              to spend it. */}
          <div className="lg:col-span-5 p-8 md:p-12 lg:p-14 flex flex-col justify-center order-2 lg:order-1">
            <Eyebrow>{PICK.eyebrow}</Eyebrow>
            <h2
              className="mt-4 font-display font-medium tracking-tight text-cocoa-900 leading-[1.02]"
              style={{ fontSize: 'clamp(2.25rem, 4.5vw, 3.5rem)' }}
            >
              {PICK.headline}
            </h2>
            <p className="mt-3 text-xl text-cocoa-900/85 font-display [text-wrap:balance]">
              {PICK.subhead}
            </p>
            <p className="mt-5 text-base md:text-lg text-cocoa-900/70 leading-relaxed max-w-md">
              {PICK.body}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" variant="cocoa">
                <Link href={PICK.primaryCta.href}>
                  {PICK.primaryCta.label}
                  <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link href={PICK.secondaryCta.href}>{PICK.secondaryCta.label}</Link>
              </Button>
            </div>
          </div>

          {/* Photo column — full-bleed on the right side of the card.
              `aspect-square` on mobile, taller on desktop so the image
              has presence without towering over the text. The cream-100
              card behind it doubles as the photo's neutral background
              if loading is slow. */}
          <div className="lg:col-span-7 relative order-1 lg:order-2 aspect-[4/3] lg:aspect-auto lg:min-h-[520px]">
            <Image
              src={PICK.image}
              alt={PICK.imageAlt}
              fill
              sizes="(min-width: 1024px) 58vw, 100vw"
              className="object-cover"
              priority
            />
          </div>
        </div>
      </div>
    </section>
  )
}
