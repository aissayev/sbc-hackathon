import Link from 'next/link'
import { BRAND } from '@/lib/brand'
import { Wordmark } from './wordmark'
import { Instagram, MapPin, Phone, Mail } from 'lucide-react'

export function SiteFooter() {
  return (
    <footer className="mt-24 bg-cocoa-900 text-cream">
      <div className="container py-14 grid gap-10 md:grid-cols-12">
        <div className="md:col-span-5">
          <Wordmark tone="cream" />
          <p className="mt-5 max-w-md text-cream/80 leading-relaxed">{BRAND.slogan}</p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm text-cream/85">
            <a
              href={BRAND.instagram}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 rounded-full border border-cream/20 px-3.5 h-9 hover:bg-cream/10"
            >
              <Instagram className="h-4 w-4" /> {BRAND.instagramHandle}
            </a>
            <a
              href={BRAND.phone.hrefTel}
              className="inline-flex items-center gap-2 rounded-full border border-cream/20 px-3.5 h-9 hover:bg-cream/10"
            >
              <Phone className="h-4 w-4" /> {BRAND.phone.display}
            </a>
          </div>
        </div>
        <div className="md:col-span-3">
          <div className="text-cream font-medium mb-3">Visit</div>
          <p className="text-sm text-cream/80 leading-relaxed">
            {BRAND.address.line1}
            <br />
            {BRAND.address.city}, {BRAND.address.region} {BRAND.address.postalCode}
          </p>
          <a
            href={BRAND.mapsUrl}
            target="_blank"
            rel="noopener"
            className="mt-3 inline-flex items-center gap-1.5 text-sm text-sky-200 hover:text-sky-100"
          >
            <MapPin className="h-4 w-4" /> Get directions
          </a>
        </div>
        <div className="md:col-span-2">
          <div className="text-cream font-medium mb-3">For everyone</div>
          <ul className="space-y-2 text-sm text-cream/80">
            <li><Link href="/menu" className="hover:text-cream">Menu</Link></li>
            <li><Link href="/order" className="hover:text-cream">Order a cake</Link></li>
            <li><Link href="/business" className="hover:text-cream">For business</Link></li>
            <li><Link href="/policies" className="hover:text-cream">Allergens & policies</Link></li>
            <li><Link href="/about" className="hover:text-cream">Our story</Link></li>
            <li><Link href="/chat" className="hover:text-cream">Chat with us</Link></li>
          </ul>
        </div>
        <div className="md:col-span-2">
          <div className="text-cream font-medium mb-3">For AI agents</div>
          <ul className="space-y-2 text-sm text-cream/80">
            <li><a href="/llms.txt" className="hover:text-cream">llms.txt</a></li>
            <li><a href="/openapi.json" className="hover:text-cream">OpenAPI 3.1</a></li>
            <li><a href="/sitemap.xml" className="hover:text-cream">Sitemap</a></li>
            <li><a href="/api/products" className="hover:text-cream">/api/products</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-cream/10">
        <div className="container py-5 flex flex-col md:flex-row gap-3 md:items-center md:justify-between text-xs text-cream/60">
          <span>© {new Date().getFullYear()} {BRAND.legal} — {BRAND.address.full}</span>
          <span className="inline-flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" /> {BRAND.email}
          </span>
        </div>
      </div>
    </footer>
  )
}
