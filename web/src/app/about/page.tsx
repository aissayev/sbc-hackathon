import type { Metadata } from 'next'
import Link from 'next/link'
import { Eyebrow } from '@/components/brand/eyebrow'
import { Button } from '@/components/ui/button'
import { HoursTable } from '@/components/brand/hours'
import { HeroImage } from '@/components/brand/hero-image'
import { BRAND, ASSETS } from '@/lib/brand'
import { MapPin, Phone, Instagram } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Our story',
  description:
    'How Happy Cake started — European traditions, warm Kazakh hospitality, hand-decorated cakes from our Sugar Land kitchen.',
  alternates: { canonical: '/about' },
}

export default function AboutPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 hero-bg pointer-events-none" aria-hidden />
        <div className="container relative pt-12 md:pt-20 pb-12 grid gap-10 lg:grid-cols-12 items-center">
          <div className="lg:col-span-6">
            <Eyebrow>Our story</Eyebrow>
            <h1 className="display-h1 mt-4 [text-wrap:balance]">
              Made with heart, served with <span className="text-sky">soul</span>.
            </h1>
            <p className="mt-5 text-lg text-cocoa-900/80 leading-relaxed max-w-xl">
              {BRAND.slogan}
            </p>
          </div>
          <div className="lg:col-span-6">
            <HeroImage
              src={ASSETS.hero[1] ?? ASSETS.hero[0]}
              alt="Inside the Happy Cake kitchen"
              className="aspect-[4/3]"
            />
          </div>
        </div>
      </section>

      <section className="container mt-16 max-w-3xl text-cocoa-900/85 space-y-5 text-lg leading-relaxed">
        <p>
          Happy Cake was born from a love of bringing people together through exceptional baked
          goods. From layered honey cakes to delicate cloud cakes, every item is crafted fresh,
          every day.
        </p>
        <p>
          Every ingredient is carefully selected. Every cake is hand-decorated and hand-packed.
          Every recipe was perfected over years until it earned its name.
        </p>
        <p>
          When customers choose our cakes for the moments that matter — birthdays, anniversaries,
          the quiet week-night dinner — our hearts cheer and sink at once. That mix of pride and
          responsibility is what keeps us improving every day.
        </p>
        <p>
          We love watching people be happy. We love making delicious things. The combination is
          Happy Cake.
        </p>
      </section>

      <section className="container mt-16 max-w-5xl">
        <Eyebrow>What we believe</Eyebrow>
        <h2 className="display-h2 mt-3">Four small commitments</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <Pillar title="Open and honest">
            We share the way we run this business — the wins and the imperfect days. Nothing about
            Happy Cake is staged. We don't delete negative comments; we answer them.
          </Pillar>
          <Pillar title="Creating value">
            A cake is more than a cake. It's emotion, care, and warmth. Every detail of the
            order, the box, the slice, the moment — counts.
          </Pillar>
          <Pillar title="Confident, not loud">
            We work daily on the only thing that matters: making sure the cake will be delicious.
            Confidence comes from the work, not from talking about the work.
          </Pillar>
          <Pillar title="Happy">
            Happy Cake is not Happy Cake unless it brings happiness and joy. Every cake we make
            is a chance to add a brighter moment to someone's day.
          </Pillar>
        </div>
      </section>

      <section className="container mt-20 max-w-5xl">
        <Eyebrow>Visit us</Eyebrow>
        <h2 className="display-h2 mt-3">Come say hello</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="bakery-card p-7">
            <Eyebrow decorator={false}>Hours</Eyebrow>
            <h3 className="display-h3 mt-2 text-xl">When we're open</h3>
            <HoursTable className="mt-4" />
          </div>
          <div className="bakery-card p-7">
            <Eyebrow decorator={false}>Location</Eyebrow>
            <h3 className="display-h3 mt-2 text-xl">Where to find us</h3>
            <p className="mt-4 text-cocoa-900/85 leading-relaxed">
              {BRAND.address.line1}
              <br />
              {BRAND.address.city}, {BRAND.address.region} {BRAND.address.postalCode}
            </p>
            <p className="mt-3 text-sm text-cocoa-900/65">{BRAND.address.parkingNote}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild variant="sky" size="sm">
                <a href={BRAND.mapsUrl} target="_blank" rel="noopener">
                  <MapPin /> Get directions
                </a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href={BRAND.phone.hrefTel}>
                  <Phone /> {BRAND.phone.display}
                </a>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <a href={BRAND.instagram} target="_blank" rel="noopener">
                  <Instagram /> {BRAND.instagramHandle}
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="container mt-20 mb-20 max-w-5xl">
        <div className="rounded-[28px] bg-cocoa-900 text-cream p-10 md:p-14 relative overflow-hidden">
          <div className="absolute inset-0 pattern-dots-cream opacity-25" aria-hidden />
          <div className="relative max-w-2xl">
            <p className="font-display text-2xl md:text-4xl leading-tight">
              Today's bake is out — see what we're known for.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg" variant="sky">
                <Link href="/menu">See the menu</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="ghost"
                className="text-cream hover:bg-cream/10"
              >
                <Link href="/order">Order a cake</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

function Pillar({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bakery-card p-6">
      <h3 className="display-h3 text-xl">{title}</h3>
      <p className="mt-2 text-cocoa-900/75 text-sm leading-relaxed">{children}</p>
    </div>
  )
}
