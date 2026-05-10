import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Eyebrow } from '@/components/brand/eyebrow'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Track an order',
  description:
    'Look up any Happy Cake order with its tracking code. Live status updates as the cake moves through the kitchen.',
  alternates: { canonical: '/track' },
}

type SearchParams = Promise<{ code?: string }>

export default async function TrackLanding(props: { searchParams?: SearchParams }) {
  const sp = (await props.searchParams) ?? {}
  if (sp.code && sp.code.trim()) {
    redirect(`/track/${encodeURIComponent(sp.code.trim())}`)
  }

  return (
    <section className="container pt-12 md:pt-16 pb-16 max-w-xl">
      <Eyebrow>Order tracking</Eyebrow>
      <h1 className="display-h1 mt-3">Track your order</h1>
      <p className="mt-3 text-cocoa-900/80">
        Paste the order code from your confirmation message — it starts with{' '}
        <code className="px-1.5 py-0.5 rounded bg-cocoa-700/8 text-sm">ord_</code>. We'll show you exactly where the cake is.
      </p>

      <form action="/track" method="get" className="mt-8 flex gap-3">
        <input
          type="text"
          name="code"
          placeholder="ord_xxxxxxxx"
          required
          autoComplete="off"
          className="flex-1 rounded-md border border-cocoa-700/20 bg-white px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-sky"
        />
        <Button type="submit">Track</Button>
      </form>

      <div className="mt-12 text-sm text-cocoa-900/70">
        <p>
          Lost your code?{' '}
          <Link href="/chat" className="underline hover:no-underline">
            Chat with us
          </Link>{' '}
          with the name on the order — we'll find it.
        </p>
      </div>
    </section>
  )
}
