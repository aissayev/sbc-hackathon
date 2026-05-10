import type { Metadata } from 'next'
import Link from 'next/link'
import { listProducts } from '@/lib/api'
import { BRAND } from '@/lib/brand'
import { Eyebrow } from '@/components/brand/eyebrow'
import { ChatWidget } from '@/components/chat/chat-widget'
import { Phone, MessageCircle } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Chat',
  description:
    'Talk to the HappyCake on-site assistant — ask about today\'s bake, allergens, custom cakes, lead times, and order status.',
  alternates: { canonical: '/chat' },
}

type SearchParams = Promise<{ product?: string }>

export default async function ChatPage(props: { searchParams?: SearchParams }) {
  const params = (await props.searchParams) ?? {}
  const products = await listProducts()
  const productNames = Object.fromEntries(products.map((p) => [p.id, p.name]))

  return (
    <section className="container pt-12 md:pt-16 pb-20">
      <div className="max-w-2xl mx-auto text-center">
        <Eyebrow>Chat with us</Eyebrow>
        <h1 className="display-h1 mt-3 [text-wrap:balance]">
          Tell us what you&apos;re celebrating — <span className="text-sky">we&apos;ll find the cake</span>
        </h1>
        <p className="mt-4 text-cocoa-900/80 leading-relaxed">
          Ask anything — what&apos;s in the case today, allergens, custom cakes, status of an order.
          Real cake people, real-time. We can check kitchen capacity, hold a slice, or start an
          order for you.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2 text-sm">
          <a
            href={BRAND.phone.hrefTel}
            className="inline-flex items-center gap-1.5 rounded-full bg-cream-100 hover:bg-cream-200 border border-cocoa-700/10 px-4 h-9 text-cocoa-900"
          >
            <Phone className="h-3.5 w-3.5" /> {BRAND.phone.display}
          </a>
          <a
            href={BRAND.whatsapp}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1.5 rounded-full bg-cream-100 hover:bg-cream-200 border border-cocoa-700/10 px-4 h-9 text-cocoa-900"
          >
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </a>
        </div>
      </div>

      <div className="mt-10 max-w-2xl mx-auto">
        <ChatWidget seedProduct={params.product} productNames={productNames} />
      </div>

      <p className="mt-6 max-w-2xl mx-auto text-center text-xs text-cocoa-900/55 leading-relaxed">
        Custom and catering orders go to the team for a quick review before the kitchen starts.
        We&apos;ll reply right here as soon as we have an answer.{' '}
        <Link href="/policies#cancellation" className="underline">
          Cancellation policy
        </Link>{' '}
        ·{' '}
        <Link href="/dietary" className="underline">
          Dietary guide
        </Link>
      </p>
    </section>
  )
}
