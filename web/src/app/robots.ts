import type { MetadataRoute } from 'next'
import { BRAND } from '@/lib/brand'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // We welcome AI crawlers — agents are first-class customers here.
      // /track/* is a per-customer-order surface — useful as a shareable link
      // but we don't want crawlers building an index of order ids.
      { userAgent: '*', allow: '/', disallow: ['/admin', '/order/confirm', '/track', '/api/admin'] },
    ],
    sitemap: `${BRAND.origin}/sitemap.xml`,
    host: BRAND.origin,
  }
}
