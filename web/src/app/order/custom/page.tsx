import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Eyebrow } from '@/components/brand/eyebrow'
import { CustomCakeFunnel } from '@/components/order/custom-cake-funnel'

export const metadata: Metadata = {
  title: 'Design a custom cake',
  description:
    'Build a custom cake — birthday, anniversary, wedding, or anything else. Five quick steps; our team confirms by phone within an hour during open hours.',
  alternates: { canonical: '/order/custom' },
}

export default function CustomOrderPage() {
  return (
    <section className="container pt-12 md:pt-16 pb-16">
      <div className="max-w-2xl">
        <Eyebrow>Custom cake</Eyebrow>
        <h1 className="display-h1 mt-3 [text-wrap:balance]">
          Design a cake <span className="text-sky">just for you</span>.
        </h1>
        <p className="mt-3 text-cocoa-900/80 leading-relaxed">
          Five quick steps. We'll review the design, source ingredients, and confirm the final
          price by phone. Custom cakes need 24 hours minimum (36 for vegan or gluten-free).
        </p>
      </div>
      <div className="mt-10">
        <Suspense fallback={<div className="h-64 rounded-2xl bg-cream-100 animate-pulse" />}>
          <CustomCakeFunnel />
        </Suspense>
      </div>
    </section>
  )
}
