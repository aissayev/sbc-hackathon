import Link from 'next/link'
import { BRAND } from '@/lib/brand'
import { Wordmark } from './wordmark'

export function SiteFooter() {
  return (
    <footer className="mt-24 bg-happy-900 text-cream-50">
      <div className="container py-12 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <Wordmark className="text-cream-50" />
          <p className="mt-4 max-w-md text-cream-50/80">
            {BRAND.tagline} {BRAND.slogan}
          </p>
          <p className="mt-3 text-sm text-cream-50/60">{BRAND.city}</p>
        </div>
        <div>
          <div className="text-cream-50 font-medium mb-3">For everyone</div>
          <ul className="space-y-2 text-sm text-cream-50/80">
            <li><Link href="/menu" className="hover:text-cream-50">Menu</Link></li>
            <li><Link href="/order" className="hover:text-cream-50">Order a cake</Link></li>
            <li><Link href="/policies" className="hover:text-cream-50">Allergens & policies</Link></li>
            <li><Link href="/about" className="hover:text-cream-50">Our story</Link></li>
            <li><Link href="/chat" className="hover:text-cream-50">Chat with us</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-cream-50 font-medium mb-3">For AI agents</div>
          <ul className="space-y-2 text-sm text-cream-50/80">
            <li><a href="/llms.txt" className="hover:text-cream-50">llms.txt</a></li>
            <li><a href="/openapi.json" className="hover:text-cream-50">OpenAPI 3.1</a></li>
            <li><a href="/sitemap.xml" className="hover:text-cream-50">Sitemap</a></li>
            <li><a href="/api/products" className="hover:text-cream-50">/api/products (JSON)</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-cream-50/10">
        <div className="container py-5 flex flex-col md:flex-row gap-3 md:items-center md:justify-between text-xs text-cream-50/60">
          <span>© {new Date().getFullYear()} HappyCake — Sugar Land, TX.</span>
          <span>Built for the Steppe Business Club AI hackathon.</span>
        </div>
      </div>
    </footer>
  )
}
