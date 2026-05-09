// Single source of truth for brand strings used in the UI.
// Mirrors docs/00-source/asset-pack.metadata.json (canonical) and the live
// happycake.us copy. The display wordmark is "Happy Cake" (two words);
// agent replies still use the brandbook spelling — this file is for the site.

export const BRAND = {
  name: 'Happy Cake',
  legal: 'Happy Cake US',
  city: 'Sugar Land, TX',
  region: 'Sugar Land + Houston metro',
  tagline: 'Where every bite tells a story.',
  slogan: 'Handcrafted cakes and pastries made with love — European traditions, warm Kazakh hospitality.',
  closing: 'Order on the site or send us a message on WhatsApp.',
  address: {
    line1: '350 Promenade Way, Suite 500',
    city: 'Sugar Land',
    region: 'TX',
    postalCode: '77478',
    country: 'US',
    full: '350 Promenade Way, Suite 500 · Sugar Land, TX 77478',
    parkingNote: 'Located in the Promenade shopping area. Plenty of parking available.',
  },
  phone: {
    display: '(281) 979-8320',
    e164: '+12819798320',
    hrefTel: 'tel:+12819798320',
  },
  whatsapp: 'https://wa.me/12819798320',
  instagram: 'https://instagram.com/happycake.us',
  instagramHandle: '@happycake.us',
  email: 'hello@happycake.us',
  origin: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://happycake.us',
  // Mon closed; Tue–Sat 11–7; Sun 12–6 (matches live happycake.us)
  hours: [
    { day: 'Monday', short: 'Mon', value: 'Closed', closed: true },
    { day: 'Tuesday', short: 'Tue', value: '11:00 AM – 7:00 PM' },
    { day: 'Wednesday', short: 'Wed', value: '11:00 AM – 7:00 PM' },
    { day: 'Thursday', short: 'Thu', value: '11:00 AM – 7:00 PM' },
    { day: 'Friday', short: 'Fri', value: '11:00 AM – 7:00 PM' },
    { day: 'Saturday', short: 'Sat', value: '11:00 AM – 7:00 PM' },
    { day: 'Sunday', short: 'Sun', value: '12:00 PM – 6:00 PM' },
  ] as const,
  // Schema.org-friendly opening-hours specification (used in Bakery JSON-LD)
  openingHoursSpec: [
    { dayOfWeek: ['Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], opens: '11:00', closes: '19:00' },
    { dayOfWeek: ['Sunday'], opens: '12:00', closes: '18:00' },
  ],
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=350+Promenade+Way+Suite+500+Sugar+Land+TX+77478',
} as const

// Asset-pack paths — see docs/00-source/asset-pack.metadata.json.
// All assets live on the hackathon public CDN; we proxy via next/image so we
// keep automatic optimization + cache-busting. No binaries in the repo.
const CDN = 'https://www.steppebusinessclub.com/hackathon-assets/happy-cake'

export const ASSETS = {
  logo: {
    px256: `${CDN}/logo/happy-cake-logo-256.png`,
    px512: `${CDN}/logo/happy-cake-logo-512.png`,
    px1024: `${CDN}/logo/happy-cake-logo-1024.png`,
  },
  hero: [
    `${CDN}/hero/happy-cake-hero-01.webp`,
    `${CDN}/hero/happy-cake-hero-02.webp`,
    `${CDN}/hero/happy-cake-hero-03.webp`,
    `${CDN}/hero/happy-cake-hero-04.webp`,
  ],
  products: Array.from({ length: 10 }, (_, i) => `${CDN}/products/happy-cake-product-${String(i + 1).padStart(2, '0')}.webp`),
  social: Array.from({ length: 8 }, (_, i) => `${CDN}/social/happy-cake-social-${String(i + 1).padStart(2, '0')}.webp`),
  // Owner + family portraits — local until the CDN bucket adds /team/ paths.
  team: {
    ownerPortrait: '/assets/team/owner-askhat.jpg',
    family: '/assets/team/family-couple.jpg',
  },
} as const

// Deterministic photo picker — same product id always gets the same shot.
export function pickProductPhoto(productId: string): string {
  let h = 0
  for (let i = 0; i < productId.length; i++) h = (h * 31 + productId.charCodeAt(i)) >>> 0
  return ASSETS.products[h % ASSETS.products.length]
}

export const CATEGORY_LABELS: Record<string, string> = {
  slices: 'Slices',
  'whole-cakes': 'Whole cakes',
  cake: 'Cakes',
  custom: 'Custom',
  catering: 'Catering',
  drinks: 'Drinks',
  pastries: 'Pastries',
}

export const ALLERGEN_LABELS: Record<string, string> = {
  eggs: 'eggs',
  dairy: 'dairy',
  gluten: 'gluten',
  nuts: 'tree nuts',
}

// Marketing pillars surfaced on the home + about pages, aligned with the
// asset pack and happycake.us content.
export const PILLARS = [
  {
    icon: 'sparkles',
    title: 'Fresh daily',
    body: 'Baked every morning with premium ingredients. Today\'s bake is what\'s in the case.',
  },
  {
    icon: 'coffee',
    title: 'Cozy vibes',
    body: 'Specialty coffee, warm light, a quiet seat. The kind of café you stay in for an extra cup.',
  },
  {
    icon: 'gift',
    title: 'Custom orders',
    body: 'Birthdays, anniversaries, baby showers — designed with you, baked to the day.',
  },
  {
    icon: 'heart',
    title: 'Made with love',
    body: 'Hand-decorated, hand-packed. Every slice is a little piece of happiness.',
  },
] as const
