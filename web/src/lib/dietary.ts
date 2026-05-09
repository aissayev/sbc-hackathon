// Dietary tags surfaced on /dietary and used to filter /menu via the
// allergen_free query param. Each tag declares a list of allergen ids it
// excludes — the menu filter runs `every(allergenInProduct → !excluded)`.
//
// The catalog tags allergens as a comma-separated list on each product
// (e.g. "eggs,dairy,gluten,nuts"). Halal-friendly is handled separately —
// it's a positive certification, not an absence-of-allergen, and it's
// applied editorially per product.

import type { LucideIcon } from 'lucide-react'
import { Wheat, Milk, Nut, Egg, Sprout, ShieldCheck } from 'lucide-react'

export interface DietaryTag {
  /** URL slug (anchors on /dietary) */
  slug: string
  /** Display name */
  label: string
  /** One-line eyebrow */
  short: string
  /** Body copy — 2 sentences. Plain English. */
  body: string
  /** Allergen ids in the catalog this tag excludes. Empty = positive label */
  excludes: string[]
  /** Lucide icon */
  icon: LucideIcon
  /** Tailwind tone class for the card icon background */
  tone: string
}

export const DIETARY_TAGS: DietaryTag[] = [
  {
    slug: 'gluten-free',
    label: 'Gluten-free',
    short: 'No wheat, no rye, no oats',
    body:
      'Cakes baked without wheat or other gluten-containing flours. Choose this if you have celiac or non-celiac sensitivity. Mind the kitchen disclaimer below.',
    excludes: ['gluten'],
    icon: Wheat,
    tone: 'bg-sky-100 text-sky-700',
  },
  {
    slug: 'no-nuts',
    label: 'No tree nuts',
    short: 'Nut-free options',
    body:
      'Cakes made without walnuts, pistachios, almonds, or pecans. We also avoid nut oils in these recipes. Severe nut allergy? Message us first.',
    excludes: ['nuts'],
    icon: Nut,
    tone: 'bg-emerald-100 text-emerald-700',
  },
  {
    slug: 'dairy-free',
    label: 'Dairy-free',
    short: 'No milk, butter, or cream',
    body:
      'Cakes that skip the dairy entirely — coconut cream and plant-based butters where the recipe calls for it. Texture is different by design; ask us if you want a sample.',
    excludes: ['dairy'],
    icon: Milk,
    tone: 'bg-cream-200 text-cocoa-700',
  },
  {
    slug: 'egg-free',
    label: 'Egg-free',
    short: 'No eggs in the batter',
    body:
      'Mostly our vegan-friendly options — flax-egg or aquafaba-bound batters. Custom orders only on shorter lead times; ask us by Wednesday for the weekend.',
    excludes: ['eggs'],
    icon: Egg,
    tone: 'bg-berry-100 text-berry',
  },
  {
    slug: 'vegan',
    label: 'Vegan-friendly',
    short: 'Plant-based, no animal products',
    body:
      'Vegan cakes — no eggs, no dairy, no honey. Available on our Red Velvet and seasonal specials, and as a custom build with 36 hours notice.',
    excludes: ['eggs', 'dairy'],
    icon: Sprout,
    tone: 'bg-emerald-100 text-emerald-700',
  },
  {
    slug: 'halal',
    label: 'Halal-friendly',
    short: 'No alcohol, no pork derivatives',
    body:
      'Our honey cake, milk maiden, pistachio roll, and most classic cakes use no alcohol and no pork-derived ingredients. Tell us when you order and we\'ll confirm.',
    excludes: [],
    icon: ShieldCheck,
    tone: 'bg-sky-100 text-sky-700',
  },
]

export interface DietaryFaqItem {
  q: string
  a: string
}

export const DIETARY_FAQ: DietaryFaqItem[] = [
  {
    q: 'Are gluten-free cakes baked in a separate kitchen?',
    a: 'No. We use shared equipment and shared spaces. We can bake cleanly with new gloves and dedicated parchment, but we cannot promise zero cross-contamination. If you have celiac, message us first and we\'ll talk through what\'s safe.',
  },
  {
    q: 'How far ahead do I need to order a custom dietary cake?',
    a: 'Standard custom takes 24 hours. Vegan or gluten-free custom needs 36 hours so we can plan the kitchen schedule and source the right ingredients.',
  },
  {
    q: 'Are there nut-free cakes that are also gluten-free?',
    a: 'Yes — ask us by phone or chat and we\'ll tell you what\'s in the case today. The intersection changes weekly.',
  },
  {
    q: 'Can you write halal certification on the box?',
    a: 'We use halal-friendly ingredients but we are not formally halal-certified. We\'ll list the ingredients honestly so you can decide.',
  },
  {
    q: 'Do you label allergens on the box?',
    a: 'Yes — every cake leaves the counter with a sticker listing the eight major allergens it contains.',
  },
]

export function dietaryHref(slug: string): string {
  const tag = DIETARY_TAGS.find((t) => t.slug === slug)
  if (!tag || tag.excludes.length === 0) return '/menu'
  return `/menu?allergen_free=${tag.excludes.join(',')}`
}
