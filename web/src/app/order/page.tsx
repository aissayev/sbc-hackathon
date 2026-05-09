import type { Metadata } from 'next'
import { Suspense } from 'react'
import { listProducts } from '@/lib/api'
import { Eyebrow } from '@/components/brand/eyebrow'
import { OrderForm } from '@/components/order/order-form'

export const metadata: Metadata = {
  title: 'Order a cake',
  description:
    'Send your order to the HappyCake kitchen in Sugar Land — Askhat reviews and confirms within an hour during open hours.',
  alternates: { canonical: '/order' },
}

export default async function OrderPage() {
  const products = await listProducts()
  return (
    <section className="container pt-12 md:pt-16 pb-16">
      <div className="max-w-2xl">
        <Eyebrow>Order a cake</Eyebrow>
        <h1 className="display-h1 mt-3">Tell us what you'd like</h1>
        <p className="mt-3 text-happy-900/80">
          Three steps. We'll review every order before the kitchen starts — usually within the
          hour. Prefer to talk it through?{' '}
          <a href="/chat" className="underline">
            Chat with us
          </a>{' '}
          instead.
        </p>
      </div>
      <div className="mt-10">
        <Suspense fallback={<div className="h-64 rounded-lg bg-cream-100 animate-pulse" />}>
          <OrderForm products={products} />
        </Suspense>
      </div>
    </section>
  )
}
