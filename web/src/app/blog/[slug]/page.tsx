import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { ChevronLeft, MessageSquareHeart, ShoppingBag } from 'lucide-react'

import { BRAND } from '@/lib/brand'
import { BLOG_POSTS, findBlogPost, type BlogBlock } from '@/lib/blog'
import { Eyebrow } from '@/components/brand/eyebrow'
import { Button } from '@/components/ui/button'

export const revalidate = 600

type Params = Promise<{ slug: string }>

export async function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata(props: { params: Params }): Promise<Metadata> {
  const { slug } = await props.params
  const post = findBlogPost(slug)
  if (!post) return { title: 'Story not found' }
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: `${post.title} · ${BRAND.name}`,
      description: post.description,
      images: [post.hero_url],
      type: 'article',
      publishedTime: post.published_at,
    },
  }
}

export default async function BlogPostPage(props: { params: Params }) {
  const { slug } = await props.params
  const post = findBlogPost(slug)
  if (!post) notFound()

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${BRAND.origin}/blog/${post.slug}`,
    headline: post.title,
    description: post.description,
    image: [post.hero_url],
    datePublished: post.published_at,
    dateModified: post.published_at,
    author: { '@type': 'Person', name: 'Askhat', affiliation: BRAND.name },
    publisher: {
      '@type': 'Organization',
      name: BRAND.name,
      logo: { '@type': 'ImageObject', url: `${BRAND.origin}/logos/icon.svg` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${BRAND.origin}/blog/${post.slug}` },
    keywords: post.tags.join(', '),
    wordCount: post.body.reduce(
      (n, b) => n + (b.type === 'p' ? b.text.split(' ').length : b.type === 'ul' ? b.items.join(' ').split(' ').length : 0),
      0,
    ),
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Stories', item: `${BRAND.origin}/blog` },
      { '@type': 'ListItem', position: 2, name: post.title, item: `${BRAND.origin}/blog/${post.slug}` },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <div className="container pt-8">
        <Link href="/blog" className="inline-flex items-center text-sm text-sky-700 hover:text-sky">
          <ChevronLeft className="h-4 w-4" /> All stories
        </Link>
      </div>

      <article className="container max-w-3xl pt-6 pb-12">
        <Eyebrow>Story · {post.read_minutes} min read</Eyebrow>
        <h1 className="display-h1 mt-3 text-[2.4rem] md:text-[3rem] leading-[1.05] [text-wrap:balance]">
          {post.title}
        </h1>
        <p className="mt-4 text-xs uppercase tracking-[0.16em] text-cocoa-900/55">
          {new Date(post.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>

        <div className="relative mt-8 aspect-[16/9] rounded-2xl overflow-hidden bg-cream-100">
          <Image
            src={post.hero_url}
            alt={post.title}
            fill
            sizes="(max-width: 1024px) 100vw, 768px"
            className="object-cover"
            priority
            unoptimized
          />
        </div>

        <div className="mt-10 space-y-5 text-cocoa-900/85 text-lg leading-relaxed">
          {post.body.map((block, i) => (
            <Block key={i} block={block} />
          ))}
        </div>

        <div className="mt-12 rounded-2xl bg-cream-100 border border-cocoa-700/10 p-6 md:p-8">
          <Eyebrow>From the same kitchen</Eyebrow>
          <h3 className="display-h3 mt-2">Ready when you are.</h3>
          <p className="mt-2 text-cocoa-900/75 max-w-prose">
            Browse the case, design a custom cake, or send us a question. {BRAND.closing}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/menu">
                <ShoppingBag /> See the menu
              </Link>
            </Button>
            <Button asChild variant="outline-sky">
              <Link href="/chat">
                <MessageSquareHeart /> Ask a question
              </Link>
            </Button>
          </div>
        </div>
      </article>
    </>
  )
}

function Block({ block }: { block: BlogBlock }) {
  switch (block.type) {
    case 'p':
      return <p>{block.text}</p>
    case 'h2':
      return <h2 className="display-h2 mt-10 mb-2 [text-wrap:balance]">{block.text}</h2>
    case 'h3':
      return <h3 className="display-h3 mt-8 mb-1 [text-wrap:balance]">{block.text}</h3>
    case 'ul':
      return (
        <ul className="space-y-2 list-disc pl-5 marker:text-sky">
          {block.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      )
    case 'callout':
      return (
        <aside className="not-prose rounded-xl border border-sky/30 bg-sky/5 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-sky-700 font-medium">{block.title}</p>
          <p className="mt-2 text-cocoa-900/85">{block.text}</p>
        </aside>
      )
    case 'quote':
      return (
        <blockquote className="border-l-4 border-cocoa-700/30 pl-5 italic text-cocoa-900/80">
          “{block.text}”
          {block.cite && <footer className="not-italic mt-2 text-sm text-cocoa-900/60">— {block.cite}</footer>}
        </blockquote>
      )
  }
}
