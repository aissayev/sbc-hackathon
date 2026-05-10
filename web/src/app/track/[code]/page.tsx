import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getOrder } from '@/lib/api'
import { Eyebrow } from '@/components/brand/eyebrow'
import { OrderStatusView } from '@/components/order/order-status'
import { Button } from '@/components/ui/button'
import { BRAND } from '@/lib/brand'

type Params = Promise<{ code: string }>
type SearchParams = Promise<{ embed?: string }>

export async function generateMetadata(props: { params: Params }): Promise<Metadata> {
  const { code } = await props.params
  return {
    title: `Track order #${code.slice(-8)}`,
    description: `Live status for ${BRAND.name} order ${code}.`,
    robots: { index: false, follow: false },
    alternates: { canonical: `/track/${code}` },
  }
}

export default async function TrackPage(props: { params: Params; searchParams?: SearchParams }) {
  const { code } = await props.params
  const sp = (await props.searchParams) ?? {}
  const embed = sp.embed === '1'
  const order = await getOrder(code)
  if (!order) notFound()

  if (embed) {
    return (
      <>
        {/*
          When ?embed=1 we hide the site chrome via :has() so the page renders
          as a self-contained card suitable for an iframe — no header, no
          footer, no help widget. All evergreen browsers (Chrome 105+,
          Safari 15.4+, Firefox 121+) support :has().
        */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              body:has([data-track-embed]) header[data-site-header],
              body:has([data-track-embed]) footer[data-site-footer],
              body:has([data-track-embed]) [data-help-widget] {
                display: none !important;
              }
              body:has([data-track-embed]) main { min-height: auto !important; }
              body:has([data-track-embed]) { background: transparent !important; }
            `,
          }}
        />
        <div data-track-embed className="p-4 md:p-6 max-w-2xl">
          <OrderStatusView initial={order} />
          <p className="mt-3 text-xs text-cocoa-900/60">
            Tracking on{' '}
            <Link href={`/track/${code}`} className="underline hover:no-underline">
              {BRAND.origin.replace(/^https?:\/\//, '')}/track/{code.slice(-8)}
            </Link>
          </p>
        </div>
      </>
    )
  }

  return (
    <section className="container pt-12 md:pt-16 pb-16 max-w-3xl">
      <Eyebrow>Order tracking</Eyebrow>
      <h1 className="display-h1 mt-3">Order #{code.slice(-8)}</h1>
      <p className="mt-3 text-cocoa-900/80">
        Live status — refreshes automatically. Bookmark this page or share the link with whoever's
        picking up.
      </p>

      <div className="mt-10">
        <OrderStatusView initial={order} />
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild variant="secondary">
          <Link href="/menu">Back to the menu</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/chat">Have a question? Chat with us</Link>
        </Button>
      </div>

      <div className="mt-12 rounded-lg border border-cocoa-700/15 bg-white/40 p-6 text-sm">
        <p className="eyebrow">Embed this status</p>
        <p className="mt-2 text-cocoa-900/80">
          Drop this iframe in a confirmation email or partner site to share live order status.
        </p>
        <pre className="mt-3 overflow-x-auto rounded bg-cocoa-900 p-3 text-xs text-cream-50">
{`<iframe src="${BRAND.origin}/track/${code}?embed=1"
        width="100%" height="420" loading="lazy"
        style="border:0;border-radius:12px"></iframe>`}
        </pre>
      </div>
    </section>
  )
}
