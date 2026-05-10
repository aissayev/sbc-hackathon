import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { listProducts } from '@/lib/api'
import { Eyebrow } from '@/components/brand/eyebrow'
import { OrderForm } from '@/components/order/order-form'
import { Sparkles, ArrowRight } from 'lucide-react'

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
        className="group mt-8 grid gap-4 sm:grid-cols-[auto_1fr_auto] items-center rounded-2xl border-2 border-dashed border-sky/45 bg-sky/5 hover:bg-sky/10 hover:border-sky/70 transition-all p-5 max-w-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5"
      >
        <div className="h-12 w-12 rounded-full bg-sky text-white inline-flex items-center justify-center shrink-0 ring-4 ring-sky/15">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="inline-flex items-center gap-2 mb-1">
            <span className="text-[11px] uppercase tracking-[0.16em] font-medium text-sky-700">
              Custom cake
            </span>
            <span className="inline-flex items-center rounded-full bg-sky/15 text-sky-800 px-2 py-0.5 text-[10px] font-medium">
              24h · designed with you
            </span>
          </div>
          <div className="font-display text-lg text-cocoa-900 leading-tight group-hover:text-sky-700 transition-colors">
            Need something fully custom?
          </div>
          <div className="mt-1 text-sm text-cocoa-900/70 leading-relaxed">
            Flavours, decoration, inscription, dietary needs. Askhat quotes by phone.
          </div>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-sky-700 group-hover:text-sky-900 shrink-0">
          Start design
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>

      <div className="mt-8">
        <Suspense fallback={<div className="h-64 rounded-lg bg-cream-100 animate-pulse" />}>
          <OrderForm products={products} />
        </Suspense>
      </div>
    </section>
  )
}
