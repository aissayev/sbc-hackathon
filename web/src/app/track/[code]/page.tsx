import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getOrder } from '@/lib/api'
import { Eyebrow } from '@/components/brand/eyebrow'
import { OrderStatusView } from '@/components/order/order-status'
import { Button } from '@/components/ui/button'

// Public, shareable order-tracking page. Same component as /order/confirm/[id]
// but reachable via a short, brand-friendly URL the customer can save in
// WhatsApp / Instagram / email. Supports `?embed=1` for an iframe-friendly
// minimal view (no site header/footer/widget) so partners or our own
// /api/chat replies can drop a tracking widget into other pages.

export const metadata: Metadata = {
  title: 'Track your order',
  // We don't want every share-link to be indexed — but we don't want
  // crawlers blocked from finding the canonical /track route either, so
  // leave robots default and rely on the order id being unguessable.
  robots: { index: false, follow: false },
}

type Params = Promise<{ code: string }>
type Search = Promise<{ embed?: string }>

export default async function TrackPage(props: { params: Params; searchParams: Search }) {
  const { code } = await props.params
  const { embed } = await props.searchParams
  const isEmbed = embed === '1'

  const order = await getOrder(code)
  if (!order) notFound()

  const body = (
    <>
      {!isEmbed && (
        <>
          <Eyebrow>Order tracker</Eyebrow>
          <h1 className="display-h1 mt-3">Your order</h1>
          <p className="mt-3 text-cocoa-900/80">
            Live status. Refresh nothing — this page updates itself as the kitchen moves your cake
            through. Save this link or open it again from the WhatsApp message we sent.
          </p>
        </>
      )}
      <div className={isEmbed ? '' : 'mt-10'}>
        <OrderStatusView initial={order} />
      </div>
      {!isEmbed && (
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild variant="secondary">
            <Link href="/menu">Back to the menu</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/chat">Need to change something? Chat with us</Link>
          </Button>
        </div>
      )}
    </>
  )

  if (isEmbed) {
    // Hide the site chrome injected by the root layout. We can't drop
    // <html>/<body> here (that's owned by app/layout.tsx) but a scoped style
    // tag does the job for the iframe surface.
    return (
      <>
        <style>{`
          html, body { background: transparent !important; }
          header, footer, [data-help-widget] { display: none !important; }
          main { min-height: 0 !important; }
        `}</style>
        <section className="px-3 py-4">{body}</section>
      </>
    )
  }

  return <section className="container pt-12 md:pt-16 pb-16 max-w-3xl">{body}</section>
}
