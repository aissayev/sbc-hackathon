import type { MetadataRoute } from 'next'
import { BRAND } from '@/lib/brand'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // We welcome AI crawlers — agents are first-class customers here.
      { userAgent: '*', allow: '/', disallow: ['/admin', '/order/confirm', '/api/admin'] },
    ],
    sitemap: `${BRAND.origin}/sitemap.xml`,
    host: BRAND.origin,
  }
}
