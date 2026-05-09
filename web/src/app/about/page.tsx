import type { Metadata } from 'next'
import Link from 'next/link'
import { Eyebrow } from '@/components/brand/eyebrow'
import { Button } from '@/components/ui/button'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: 'Our story',
  description:
    'How HappyCake started — homemade taste, Sugar Land kitchen, hand-decorated cakes for the moments that matter.',
  alternates: { canonical: '/about' },
}

export default function AboutPage() {
  return (
    <>
      <section className="container pt-12 md:pt-16 max-w-3xl">
        <Eyebrow>Our story</Eyebrow>
        <h1 className="display-h1 mt-3">{BRAND.slogan}</h1>
      </section>

      <section className="container mt-10 max-w-3xl text-happy-900/85 space-y-5 text-lg leading-relaxed">
        <p>
          It started with a phrase: <em>"It's just like homemade."</em>
        </p>
        <p>
          We started baking cakes. As if for ourselves. Delicious, sweet, fresh cakes. People kept
          coming back saying <em>"It tastes like I baked it myself"</em> and{' '}
          <em>"It tastes so good — like real home baking"</em>. And we realised that homemade taste
          was the centre of what we wanted to make.
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
          HappyCake.
        </p>
      </section>

      <section className="container mt-16 max-w-3xl">
        <div className="grid gap-6 sm:grid-cols-2">
          <Pillar title="Open and honest">
            We share the way we run this business — the wins and the imperfect days. Nothing about
            HappyCake is staged. We don't delete negative comments; we answer them.
          </Pillar>
          <Pillar title="Creating value">
            A cake is more than a cake. It's emotion, care, and warmth. Every detail of the order,
            the box, the slice, the moment — counts.
          </Pillar>
          <Pillar title="Confident">
            We work daily on the only thing that matters: making sure the cake will be delicious.
            Confidence comes from the work, not from talking about the work.
          </Pillar>
          <Pillar title="Happy">
            HappyCake is not HappyCake unless it brings happiness and joy. Every cake we make,
            every interaction we have, is a chance to add a brighter moment to someone's day.
          </Pillar>
        </div>
      </section>

      <section className="container mt-16 max-w-3xl mb-16">
        <div className="rounded-lg bg-happy-900 text-cream-50 p-8 md:p-10 relative overflow-hidden">
          <div className="absolute inset-0 pattern-dots-cream opacity-25" aria-hidden />
          <div className="relative">
            <p className="font-display text-2xl md:text-3xl">
              Today's bake is out — see what we're known for.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-cream-50 text-happy-900 hover:bg-cream-100">
                <Link href="/menu">See the menu</Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="text-cream-50 hover:bg-happy-700">
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
    <div className="rounded-lg border border-happy-700/15 bg-cream-100 p-5">
      <h3 className="display-h3">{title}</h3>
      <p className="mt-2 text-happy-900/80 text-sm leading-relaxed">{children}</p>
    </div>
  )
}
