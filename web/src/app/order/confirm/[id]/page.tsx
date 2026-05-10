import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getOrder } from '@/lib/api'
import { Eyebrow } from '@/components/brand/eyebrow'
import { OrderStatusView } from '@/components/order/order-status'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Order received',
  robots: { index: false, follow: false },
}

type Params = Promise<{ id: string }>

export default async function OrderConfirmPage(props: { params: Params }) {
  const { id } = await props.params
  const order = await getOrder(id)
  if (!order) notFound()

  return (
    <section className="container pt-12 md:pt-16 pb-16 max-w-3xl">
      <Eyebrow>Order received</Eyebrow>
      <h1 className="display-h1 mt-3">Thank you</h1>
      <p className="mt-3 text-cocoa-900/80">
        Askhat will look at this within the hour and confirm by phone or WhatsApp. Track the
        status here — we'll keep this page up to date as the cake moves through the kitchen.
      </p>

      <div className="mt-10">
        <OrderStatusView initial={order} />
      </div>

      <p className="mt-6 text-sm text-cocoa-900/70">
        Want to share the live status with someone?{' '}
        <Link href={`/track/${id}`} className="underline hover:text-cocoa-900">
          Use this short link
        </Link>{' '}
        — it shows the same tracker without the rest of the site, so it's easy to drop into a
        message.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild variant="secondary">
          <Link href="/menu">Back to the menu</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/chat">Have a question? Chat with us</Link>
        </Button>
      </div>
    </section>
  )
}
