import type { Metadata } from 'next'
import { listProducts } from '@/lib/api'
import { Eyebrow } from '@/components/brand/eyebrow'
import { ChatWidget } from '@/components/chat/chat-widget'

export const metadata: Metadata = {
  title: 'Chat',
  description:
    'Talk to the Happy Cake on-site assistant — ask about today\'s bake, allergens, custom cakes, lead times, and order status.',
  alternates: { canonical: '/chat' },
}

type SearchParams = Promise<{ product?: string }>

export default async function ChatPage(props: { searchParams?: SearchParams }) {
  const params = (await props.searchParams) ?? {}
  const products = await listProducts()
  const productNames = Object.fromEntries(products.map((p) => [p.id, p.name]))

  return (
    <section className="container pt-12 md:pt-16 pb-16">
      <div className="max-w-2xl">
        <Eyebrow>Chat with us</Eyebrow>
        <h1 className="display-h1 mt-3">We're listening</h1>
        <p className="mt-3 text-cocoa-900/80">
          Ask anything — what's in the case today, allergens, custom cakes, status of an order.
          Real cake people, real-time. The assistant can check kitchen capacity and draft an order
          for the owner to approve.
        </p>
      </div>
      <div className="mt-8 max-w-2xl">
        <ChatWidget seedProduct={params.product} productNames={productNames} />
      </div>
      <p className="mt-6 max-w-2xl text-xs text-cocoa-900/60">
        Drafts are queued for the owner to approve in Telegram before the kitchen starts. Replies
        appear in this thread as soon as we have them. Press Start over to begin a fresh conversation.
      </p>
    </section>
  )
}
