import Link from 'next/link'
import { BRAND } from '@/lib/brand'
import { HoursTable, isOpenNow } from './hours'
import { Wordmark } from './wordmark'
import { Instagram, MapPin, Phone, Mail, Clock, MessageSquareHeart } from 'lucide-react'

// Footer doubles as the site's "Store information" surface — hours, address,
// phone, email, social, and a live open/closed indicator. The About page no
// longer carries this block; the footer is the canonical place to find it.

export function SiteFooter() {
  const status = isOpenNow()
  return (
    <footer className="mt-24 bg-cocoa-900 text-cream">
      {/* Visit + contact band — the "store information" hub. Three columns on
          desktop: brand + open-now + map / hours / contact. Stacks cleanly on
          mobile because each card is its own block. */}
      <section aria-labelledby="footer-visit" className="border-b border-cream/10">
        <div className="container py-14 grid gap-10 md:gap-8 md:grid-cols-12">
          <div className="md:col-span-4">
            <h2 id="footer-visit" className="sr-only">Visit Happy Cake in Sugar Land</h2>
            <Wordmark tone="cream" />
            <p className="mt-4 max-w-md text-cream/80 leading-relaxed text-sm">
              {BRAND.slogan}
            </p>
            <span
              className={`mt-5 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
                status.open ? 'bg-emerald-500/15 text-emerald-200' : 'bg-cream/10 text-cream/85'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  status.open ? 'bg-emerald-400 animate-pulse' : 'bg-cream/55'
                }`}
                aria-hidden
              />
              {status.open ? 'Open now' : 'Closed'} · {status.nextChange}
            </span>
            <div className="mt-6 flex flex-wrap gap-2">
              <a
                href={BRAND.instagram}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-2 rounded-full border border-cream/20 px-3.5 h-9 text-sm hover:bg-cream/10"
              >
                <Instagram className="h-4 w-4" /> {BRAND.instagramHandle}
              </a>
              <Link
                href="/chat"
                className="inline-flex items-center gap-2 rounded-full border border-cream/20 px-3.5 h-9 text-sm hover:bg-cream/10"
              >
                <MessageSquareHeart className="h-4 w-4" /> Chat with us
              </Link>
            </div>
          </div>

          <div className="md:col-span-4">
            <FooterEyebrow icon={<MapPin className="h-3.5 w-3.5" />}>Where to find us</FooterEyebrow>
            <p className="mt-3 leading-relaxed text-sm text-cream/85">
              {BRAND.address.line1}
              <br />
              {BRAND.address.city}, {BRAND.address.region} {BRAND.address.postalCode}
            </p>
            <p className="mt-2 text-xs text-cream/60 leading-relaxed">{BRAND.address.parkingNote}</p>
            <a
              href={BRAND.mapsUrl}
              target="_blank"
              rel="noopener"
              className="mt-4 inline-flex items-center gap-1.5 text-sm text-sky-200 hover:text-sky-100"
            >
              <MapPin className="h-4 w-4" /> Get directions
            </a>
            <div className="mt-5 grid gap-2 text-sm">
              <a
                href={BRAND.phone.hrefTel}
                className="inline-flex items-center gap-2 text-cream/85 hover:text-cream"
              >
                <Phone className="h-4 w-4 text-cream/60" /> {BRAND.phone.display}
              </a>
              <a
                href={`mailto:${BRAND.email}`}
                className="inline-flex items-center gap-2 text-cream/85 hover:text-cream"
              >
                <Mail className="h-4 w-4 text-cream/60" /> {BRAND.email}
              </a>
            </div>
          </div>

          <div className="md:col-span-4">
            <FooterEyebrow icon={<Clock className="h-3.5 w-3.5" />}>When we&apos;re open</FooterEyebrow>
            <HoursTable className="mt-3 [&_li]:py-1.5 [&_li>span:first-child]:text-cream/65 [&_li>span:last-child]:text-cream divide-cream/10" />
          </div>
        </div>
      </section>

      {/* Sitemap row — kept slim so the visit band reads as primary. */}
      <section aria-labelledby="footer-explore">
        <div className="container py-10 grid gap-8 md:grid-cols-3">
          <div>
            <FooterEyebrow>Explore</FooterEyebrow>
            <ul className="mt-3 grid gap-2 text-sm text-cream/80">
              <li><Link href="/menu" className="hover:text-cream">Menu</Link></li>
              <li><Link href="/order" className="hover:text-cream">Order a cake</Link></li>
              <li><Link href="/order/custom" className="hover:text-cream">Custom cake</Link></li>
              <li><Link href="/dietary" className="hover:text-cream">Dietary guide</Link></li>
            </ul>
          </div>
          <div>
            <FooterEyebrow>About</FooterEyebrow>
            <ul className="mt-3 grid gap-2 text-sm text-cream/80">
              <li><Link href="/about" className="hover:text-cream">About us</Link></li>
              <li><Link href="/blog" className="hover:text-cream">Stories &amp; guides</Link></li>
              <li><Link href="/press" className="hover:text-cream">Press &amp; podcasts</Link></li>
              <li><Link href="/policies" className="hover:text-cream">Visit &amp; FAQ</Link></li>
            </ul>
          </div>
          <div>
            <FooterEyebrow>Talk to us</FooterEyebrow>
            <ul className="mt-3 grid gap-2 text-sm text-cream/80">
              <li><Link href="/chat" className="hover:text-cream">Chat with us</Link></li>
              <li><Link href="/business" className="hover:text-cream">For business</Link></li>
              <li><Link href="/business/inquire" className="hover:text-cream">B2B inquiry</Link></li>
              <li>
                <a href={BRAND.whatsapp} target="_blank" rel="noopener" className="hover:text-cream">
                  WhatsApp
                </a>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Slim bottom bar — keeps llms.txt / sitemap reachable for AI crawlers
          and the rubric, without making them a hero block in the footer. */}
      <div className="border-t border-cream/10">
        <div className="container py-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between text-xs text-cream/55">
          <span>© {new Date().getFullYear()} {BRAND.legal} — {BRAND.address.full}</span>
          <span className="inline-flex items-center gap-3 flex-wrap">
            <Link href="/admin" className="hover:text-cream/80" title="Owner console">Owner</Link>
            <span aria-hidden>·</span>
            <a href="/llms.txt" className="hover:text-cream/80" title="AI agent surface map">llms.txt</a>
            <a href="/sitemap.xml" className="hover:text-cream/80">sitemap</a>
          </span>
        </div>
      </div>
    </footer>
  )
}

function FooterEyebrow({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-cream/55">
      {icon}
      {children}
    </div>
  )
}
