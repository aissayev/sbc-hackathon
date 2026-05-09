import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { listProducts } from '@/lib/api'
import { Eyebrow } from '@/components/brand/eyebrow'
import { OrderForm } from '@/components/order/order-form'
import { Sparkles } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Order a cake',
  description:
    'Send your order to the Happy Cake kitchen in Sugar Land — Askhat reviews and confirms within an hour during open hours.',
  alternates: { canonical: '/order' },
}

export default async function OrderPage() {
  const products = await listProducts()
  return (
    <section className="container pt-12 md:pt-16 pb-16">
      <div className="max-w-2xl">
        <Eyebrow>Order a cake</Eyebrow>
        <h1 className="display-h1 mt-3">Tell us what you'd like</h1>
        <p className="mt-3 text-cocoa-900/80">
          Three steps. We'll review every order before the kitchen starts — usually within the
          hour. Prefer to talk it through?{' '}
          <a href="/chat" className="underline">
            Chat with us
          </a>{' '}
          instead.
        </p>
      </div>

      <Link
        href="/order/custom"
        className="mt-8 flex items-center gap-4 rounded-2xl border border-sky/40 bg-sky/5 hover:bg-sky/10 transition-colors p-5 max-w-2xl"
      >
        <div className="h-11 w-11 rounded-full bg-sky text-white inline-flex items-center justify-center shrink-0">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="font-medium text-cocoa-900">Need something custom?</div>
          <div className="text-sm text-cocoa-900/70">
            Build a custom cake — flavors, decoration, inscription, dietary needs. Askhat quotes by phone.
          </div>
        </div>
        <span className="text-sky text-xl shrink-0" aria-hidden>→</span>
      </Link>

      <div className="mt-8">
        <Suspense fallback={<div className="h-64 rounded-lg bg-cream-100 animate-pulse" />}>
          <OrderForm products={products} />
        </Suspense>
      </div>
    </section>
  )
}
