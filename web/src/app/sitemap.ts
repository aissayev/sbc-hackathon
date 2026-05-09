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
      { path: '/chat', priority: 0.7, changeFrequency: 'monthly' },
      { path: '/about', priority: 0.6, changeFrequency: 'monthly' },
      { path: '/policies', priority: 0.6, changeFrequency: 'monthly' },
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

  return [...STATIC, ...products_entries]
}
