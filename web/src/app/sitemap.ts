import type { MetadataRoute } from 'next'
import { listProducts } from '@/lib/api'
import { BRAND } from '@/lib/brand'

export const revalidate = 600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await listProducts()
  const now = new Date()

  const STATIC: MetadataRoute.Sitemap = (
    [
      { path: '/', priority: 1.0, changeFrequency: 'daily' },
      { path: '/menu', priority: 0.9, changeFrequency: 'daily' },
      { path: '/dietary', priority: 0.7, changeFrequency: 'weekly' },
      { path: '/order', priority: 0.9, changeFrequency: 'weekly' },
      { path: '/order/custom', priority: 0.85, changeFrequency: 'monthly' },
      { path: '/business', priority: 0.85, changeFrequency: 'monthly' },
      { path: '/business/inquire', priority: 0.7, changeFrequency: 'monthly' },
      { path: '/chat', priority: 0.7, changeFrequency: 'monthly' },
      { path: '/about', priority: 0.6, changeFrequency: 'monthly' },
      { path: '/gift-cards', priority: 0.65, changeFrequency: 'monthly' },
      { path: '/careers', priority: 0.55, changeFrequency: 'monthly' },
      { path: '/policies', priority: 0.6, changeFrequency: 'monthly' },
      { path: '/blog', priority: 0.7, changeFrequency: 'weekly' },
      { path: '/press', priority: 0.5, changeFrequency: 'monthly' },
      { path: '/track', priority: 0.4, changeFrequency: 'monthly' },
    ] as Array<{
      path: string
      priority: number
      changeFrequency: 'daily' | 'weekly' | 'monthly'
    }>
  ).map((s) => ({
    url: `${BRAND.origin}${s.path}`,
    lastModified: now,
    changeFrequency: s.changeFrequency,
    priority: s.priority,
  }))

  const products_entries: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${BRAND.origin}/menu/${p.id}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  const { BLOG_POSTS } = await import('@/lib/blog')
  const blog_entries: MetadataRoute.Sitemap = BLOG_POSTS.map((b) => ({
    url: `${BRAND.origin}/blog/${b.slug}`,
    lastModified: new Date(b.published_at),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }))

  return [...STATIC, ...products_entries, ...blog_entries]
}
