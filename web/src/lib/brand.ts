// Single source of truth for brand strings used in the UI.
// Mirrors docs/00-source/BRANDBOOK.md — never invent variants.

export const BRAND = {
  name: 'HappyCake',
  city: 'Sugar Land, TX',
  region: 'Sugar Land + Houston metro',
  tagline: "It's just like homemade.",
  slogan: 'The original taste of happiness.',
  closing: 'Order on the site at happycake.us or send us a message on WhatsApp.',
  whatsapp: 'https://wa.me/14155551234',
  instagram: 'https://instagram.com/happycake.us',
  email: 'hello@happycake.us',
  origin: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://happycake.us',
} as const

export const CATEGORY_LABELS: Record<string, string> = {
  slices: 'Slices',
  'whole-cakes': 'Whole cakes',
  custom: 'Custom',
  catering: 'Catering',
  drinks: 'Drinks',
}

export const ALLERGEN_LABELS: Record<string, string> = {
  eggs: 'eggs',
  dairy: 'dairy',
  gluten: 'gluten',
  nuts: 'tree nuts',
}
