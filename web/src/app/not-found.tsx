import Link from 'next/link'
import { Eyebrow } from '@/components/brand/eyebrow'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <section className="container py-24 md:py-32 max-w-2xl">
      <Eyebrow>404</Eyebrow>
      <h1 className="display-h1 mt-3">We couldn't find that page</h1>
      <p className="mt-3 text-cocoa-900/80">
        That cake might be sold out, or the link's a bit stale. Try the menu, or send us a
        message — we'll point you the right way.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/menu">See the menu</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/chat">Chat with us</Link>
        </Button>
      </div>
    </section>
  )
}
