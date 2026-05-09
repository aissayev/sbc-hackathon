import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { BRAND } from '@/lib/brand'
import { BLOG_POSTS } from '@/lib/blog'
import { Eyebrow } from '@/components/brand/eyebrow'

export const revalidate = 600

export const metadata: Metadata = {
  title: 'Stories & guides',
  description:
    'Plain-English guides from a small Sugar Land bakery — honey-cake history, custom-cake planning, allergen-aware ordering, and answers to the questions Askhat gets at the counter.',
  alternates: { canonical: '/blog' },
}

export default function BlogIndexPage() {
  const blogJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    '@id': `${BRAND.origin}/blog`,
    name: `${BRAND.name} — Stories & guides`,
    publisher: { '@type': 'Organization', name: BRAND.name, url: BRAND.origin },
    blogPost: BLOG_POSTS.map((p) => ({
      '@type': 'BlogPosting',
      headline: p.title,
      description: p.description,
      datePublished: p.published_at,
      url: `${BRAND.origin}/blog/${p.slug}`,
    })),
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(blogJsonLd) }} />
      <section className="container pt-12 md:pt-20 pb-10">
        <Eyebrow>Stories & guides</Eyebrow>
        <h1 className="display-h1 mt-4 [text-wrap:balance]">
          Notes from the <span className="text-sky">bench</span>
        </h1>
        <p className="mt-4 max-w-2xl text-cocoa-900/75 leading-relaxed">
          Short, useful pieces written by Askhat — honey-cake history, how to plan a custom cake,
          what we can promise around allergens, what to bring to a 30-person Houston office. Same
          honesty as the counter conversation.
        </p>
      </section>

      <section className="container pb-16">
        <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {BLOG_POSTS.map((post) => (
            <li key={post.slug}>
              <Link
                href={`/blog/${post.slug}`}
                className="group bakery-card flex flex-col h-full overflow-hidden hover:-translate-y-0.5 transition-transform"
              >
                <div className="relative aspect-[4/3] bg-cream-100">
                  <Image
                    src={post.hero_url}
                    alt={post.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div className="p-5 flex flex-col gap-3 flex-1">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-cocoa-900/55">
                    <span>{new Date(post.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    <span aria-hidden>·</span>
                    <span>{post.read_minutes} min read</span>
                  </div>
                  <h2 className="display-h3 group-hover:text-sky-700 transition-colors [text-wrap:balance]">
                    {post.title}
                  </h2>
                  <p className="text-sm text-cocoa-900/70 leading-relaxed line-clamp-3">{post.description}</p>
                  <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
                    {post.tags.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center rounded-full bg-cream-100 border border-cocoa-700/10 px-2 py-0.5 text-[11px] text-cocoa-900/70"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
