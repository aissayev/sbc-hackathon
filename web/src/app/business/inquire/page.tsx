import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Eyebrow } from '@/components/brand/eyebrow'
import { B2BInquireForm } from '@/components/business/inquire-form'

export const metadata: Metadata = {
  title: 'Send a business inquiry',
  description:
    'Five quick steps to a custom B2B proposal — office breaks, events, gifting, or a standing program.',
  alternates: { canonical: '/business/inquire' },
}

export default function BusinessInquirePage() {
  return (
    <section className="container pt-12 md:pt-16 pb-16 max-w-3xl">
      <Eyebrow>Business inquiry</Eyebrow>
      <h1 className="display-h1 mt-3 [text-wrap:balance]">
        Tell us about <span className="text-sky">your team</span>.
      </h1>
      <p className="mt-3 text-cocoa-900/80 leading-relaxed">
        Five quick steps. Our team reads every B2B inquiry directly and replies within one
        business day with pricing, sample plan, and next steps.
      </p>
      <div className="mt-10">
        <Suspense fallback={<div className="h-64 rounded-2xl bg-cream-100 animate-pulse" />}>
          <B2BInquireForm />
        </Suspense>
      </div>
    </section>
  )
}
