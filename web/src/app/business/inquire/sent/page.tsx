import type { Metadata } from 'next'
import Link from 'next/link'
import { Eyebrow } from '@/components/brand/eyebrow'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Mail } from 'lucide-react'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: 'Inquiry sent',
  robots: { index: false, follow: false },
}

type SearchParams = Promise<{ id?: string }>

export default async function BusinessInquirySentPage(props: { searchParams?: SearchParams }) {
  const { id } = (await props.searchParams) ?? {}
  return (
    <section className="container pt-16 md:pt-24 pb-20 max-w-2xl text-center">
      <div className="h-16 w-16 mx-auto rounded-full bg-emerald-100 text-emerald-700 inline-flex items-center justify-center">
        <CheckCircle2 className="h-7 w-7" />
      </div>
      <Eyebrow className="mt-6 justify-center">Inquiry received</Eyebrow>
      <h1 className="display-h1 mt-3 [text-wrap:balance]">Thank you — we'll reply within one business day</h1>
      <p className="mt-4 text-cocoa-900/80 leading-relaxed">
        Askhat reads every B2B inquiry himself. You'll get a reply at the email you provided with
        pricing, a sample plan, and next steps. If we don't get back within 24 business hours,
        please email us — sometimes a reply gets stuck.
      </p>
      {id && (
        <p className="mt-6 text-xs text-cocoa-900/60">
          Reference: <code className="bg-cream-100 rounded px-2 py-0.5">{id.slice(-8)}</code>
        </p>
      )}
      <div className="mt-10 flex flex-wrap gap-3 justify-center">
        <Button asChild size="lg">
          <Link href="/menu">Browse the menu</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <a href={`mailto:${BRAND.email}`}>
            <Mail /> {BRAND.email}
          </a>
        </Button>
      </div>
    </section>
  )
}
