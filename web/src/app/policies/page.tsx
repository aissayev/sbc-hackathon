import type { Metadata } from 'next'
import Link from 'next/link'
import { Eyebrow } from '@/components/brand/eyebrow'

export const metadata: Metadata = {
  title: 'Visit & FAQ',
  description:
    'Plain-English answers from Happy Cake — hours, location, allergens, lead times, pickup, delivery, payment, cancellation, halal-friendly options.',
  alternates: { canonical: '/policies' },
}

export default function PoliciesPage() {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((q) => ({
      '@type': 'Question',
      name: q.q,
      acceptedAnswer: { '@type': 'Answer', text: q.a },
    })),
  }
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <section className="container pt-12 md:pt-16 max-w-3xl">
        <Eyebrow>Visit & FAQ</Eyebrow>
        <h1 className="display-h1 mt-3">Plain answers — hours, allergens, ordering details</h1>
        <p className="mt-3 text-cocoa-900/80">
          Everything you might want to check before walking in or placing an order. If something
          here is unclear,{' '}
          <Link href="/chat" className="underline">
            send us a message
          </Link>{' '}
          — we&apos;ll explain it the way we&apos;d explain it to a neighbour.
        </p>
      </section>

      <section className="container mt-12 mb-16 max-w-3xl space-y-10">
        {SECTIONS.map((s) => (
          <div key={s.title} id={slug(s.title)}>
            <h2 className="display-h2">{s.title}</h2>
            <div className="mt-3 text-cocoa-900/85 space-y-3">{s.body}</div>
          </div>
        ))}

        <div id="faq" className="mt-16">
          <h2 className="display-h2">Common questions</h2>
          <div className="mt-4 divide-y divide-cocoa-700/15 rounded-lg border border-cocoa-700/15 bg-white">
            {FAQ.map((q) => (
              <details key={q.q} className="group p-5">
                <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
                  <span className="font-medium text-cocoa-900">{q.q}</span>
                  <span className="text-cocoa-700 group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="mt-3 text-cocoa-900/80 text-sm">{q.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z]+/g, '-').replace(/(^-|-$)/g, '')
}

const SECTIONS: Array<{ title: string; body: React.ReactNode }> = [
  {
    title: 'Lead times',
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li>Slices and rolls — usually ready from the case. About an hour's notice if we're out.</li>
        <li>Whole honey cake — about an hour for cutting and packaging.</li>
        <li>Custom birthday cakes — minimum 24 hours so we can design and bake.</li>
        <li>Office dessert boxes — 3 hours for an assortment, longer for groups over fifty.</li>
      </ul>
    ),
  },
  {
    title: 'Allergens',
    body: (
      <>
        <p>
          Our kitchen handles eggs, dairy, gluten, and tree nuts in shared spaces. Every cake we
          make has at least one of these. If you have a severe allergy, message us and we'll talk
          you through what we can and can't do safely.
        </p>
        <p className="mt-3">
          <Link href="/dietary" className="text-sky-700 underline-offset-4 hover:underline font-medium">
            See the full dietary guide →
          </Link>{' '}
          for gluten-free, nut-free, dairy-free, vegan, and halal-friendly options.
        </p>
      </>
    ),
  },
  {
    title: 'Pickup & delivery',
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li>Pickup is free — at our Sugar Land kitchen.</li>
        <li>Local delivery available across Sugar Land and the Houston metro. Fee depends on distance, confirmed at order time.</li>
        <li>We don't ship cakes — they're not the same after a day in transit.</li>
      </ul>
    ),
  },
  {
    title: 'Payment',
    body: (
      <p>
        Card via Square at confirmation, cash at pickup, or Zelle. We don't take partial payments
        or store card details on the website.
      </p>
    ),
  },
  {
    title: 'Cancellation',
    body: (
      <p>
        Cancel free up to 24 hours before. After that, we've already started the cake — late
        cancellations are charged in full. We're sorry, but we can't sell a baked cake to anyone
        else.
      </p>
    ),
  },
  {
    title: 'Halal-friendly',
    body: (
      <p>
        Most of our cakes use no alcohol or pork-derived ingredients. Tell us when you order and
        we'll confirm what's safe for you. The honey cake, milk maiden, and pistachio roll are
        always halal-friendly.
      </p>
    ),
  },
]

const FAQ = [
  {
    q: 'How far ahead should I order a custom cake?',
    a: '24 hours minimum. For Mother\'s Day, Eid, and the days around Christmas, give us 48 hours so we can plan the kitchen.',
  },
  {
    q: 'Can you write a name on the cake?',
    a: 'Yes — let us know in the order notes. Up to about 25 characters fits cleanly on the standard size.',
  },
  {
    q: 'Do you deliver to Houston?',
    a: 'Yes, across the Sugar Land + Houston metro. Fee depends on distance and is confirmed at order time.',
  },
  {
    q: 'Do you ship out of state?',
    a: 'We don\'t. Cakes aren\'t the same after a day in transit, and we\'d rather you eat one fresh from a different bakery than a tired one from us.',
  },
  {
    q: 'Are your cakes halal-friendly?',
    a: 'Most of them — no alcohol, no pork derivatives. Tell us when you order and we\'ll confirm what\'s safe for you.',
  },
  {
    q: 'How do you handle severe allergies?',
    a: 'Please message us first. Our kitchen handles eggs, dairy, gluten, and tree nuts in shared spaces, so cross-contamination is possible. We\'ll tell you honestly what we can and can\'t do safely.',
  },
]
