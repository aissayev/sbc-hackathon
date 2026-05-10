// Canonical Happy Cake catalog — mirrors docs/00-source/SNAPSHOT.md (the
// sandbox MCP `square_list_catalog` snapshot) and pairs each product with
// an approved photo from the asset pack. The website prefers this catalog
// over whatever the backend's local SQLite seed contains: that seed has
// generic placeholder SKUs (sku-classic-1kg, etc.) until the backend
// imports the real catalog.
//
// When the backend's seed catches up, this list can be retired or used
// only as a fallback. For now: source of truth for what /menu shows.
//
// Each product carries a `kind` so the menu can group cleanly:
//   slice   — by-the-slice from the case (no notice)
//   whole   — full cakes (about an hour notice)
//   pastry  — small format, sold by piece / pair / cluster
//   custom  — designed-to-order (24h+ notice)
//   catering — boxes / assortments for groups (3h+ notice)

import { ASSETS } from './brand'
import type { Product } from './api'

export const CATALOG: Product[] = [
  {
    id: 'honey-cake-slice',
    name: 'Honey Cake',
    kind: 'slice',
    category: 'slices',
    price_cents: 850,
    lead_time_hours: 1,
    allergens: 'eggs,dairy,gluten',
    description:
      'Our signature — six layers of golden honey biscuit, soft custard between every one, walnuts on top. Same recipe as the day we opened.',
    photo_url: ASSETS.products[0],
    in_stock: 1,
    daily_capacity: 80,
    tradition: 'kazakh-european-honey',
    flavor_notes: 'honey biscuit · soft custard · walnuts',
    tagline: 'Six layers, one recipe, since the day we opened.',
  },
  {
    id: 'whole-honey-cake',
    name: 'Whole Honey Cake',
    kind: 'whole',
    category: 'whole-cakes',
    price_cents: 5500,
    lead_time_hours: 1,
    allergens: 'eggs,dairy,gluten',
    description:
      'The full honey-cake experience — feeds about a dozen. Hand-decorated, hand-packed. About an hour\'s notice for cutting and packaging.',
    photo_url: ASSETS.products[6],
    in_stock: 1,
    daily_capacity: 12,
    tradition: 'kazakh-european-honey',
    flavor_notes: 'six honey layers · custard · walnut crown',
    tagline: 'The whole honey cake — feeds a table of twelve.',
  },
  {
    id: 'whole-pistachio-cake',
    name: 'Whole Pistachio Cake',
    kind: 'whole',
    category: 'whole-cakes',
    price_cents: 6500,
    lead_time_hours: 2,
    allergens: 'eggs,dairy,gluten,nuts',
    description:
      'The full pistachio meringue roll — a long log of meringue, pistachio cream, and fresh raspberry. About 90 minutes to slice and pack. Serves 10–12.',
    photo_url: ASSETS.products[3],
    in_stock: 1,
    daily_capacity: 8,
    tradition: 'modern-meringue',
    flavor_notes: 'meringue roll · pistachio cream · raspberry',
    tagline: 'The whole pistachio roll — a long log, twelve happy plates.',
  },
  {
    id: 'whole-cloud-cake',
    name: 'Whole Cloud Cake',
    kind: 'whole',
    category: 'whole-cakes',
    price_cents: 6000,
    lead_time_hours: 2,
    allergens: 'eggs,dairy,gluten',
    description:
      'The full cloud — airy meringue layers and vanilla cream, hand-decorated. Feeds about a dozen. About 90 minutes to finish and pack.',
    photo_url: ASSETS.products[8],
    in_stock: 1,
    daily_capacity: 8,
    tradition: 'modern-meringue',
    flavor_notes: 'meringue layers · vanilla cream · airy crumb',
    tagline: 'A cloud for the whole table.',
  },
  {
    id: 'whole-tiramisu-cake',
    name: 'Whole Tiramisu Cake',
    kind: 'whole',
    category: 'whole-cakes',
    price_cents: 5800,
    lead_time_hours: 2,
    allergens: 'eggs,dairy,gluten',
    description:
      'A full tray of tiramisu — espresso-soaked vanilla biscuit, milk-chocolate layers, mascarpone. Serves 10–12. Two hours notice.',
    photo_url: ASSETS.products[1],
    in_stock: 1,
    daily_capacity: 6,
    tradition: 'italian-classic',
    flavor_notes: 'espresso biscuit · mascarpone · milk chocolate',
    tagline: 'Tiramisu for the whole afternoon.',
  },
  {
    id: 'pistachio-roll',
    name: 'Pistachio Roll',
    kind: 'slice',
    category: 'slices',
    price_cents: 950,
    lead_time_hours: 1,
    allergens: 'eggs,dairy,gluten,nuts',
    description:
      'Light meringue rolled with pistachio cream and the sour-sweet of fresh raspberry. By the slice, fresh from the case.',
    photo_url: ASSETS.products[3],
    in_stock: 1,
    daily_capacity: 30,
    tradition: 'modern-meringue',
    flavor_notes: 'meringue roll · pistachio cream · fresh raspberry',
    tagline: 'Pistachio meringue, raspberry sharp — light enough for two slices.',
  },
  {
    id: 'cloud-cake-slice',
    name: 'Cloud Cake',
    kind: 'slice',
    category: 'slices',
    price_cents: 900,
    lead_time_hours: 1,
    allergens: 'eggs,dairy,gluten',
    description:
      'Light, airy layers of meringue and delicate vanilla cream. Our most-loved seasonal slice — eats like dessert and breakfast at once.',
    photo_url: ASSETS.products[8],
    in_stock: 1,
    daily_capacity: 25,
    tradition: 'modern-meringue',
    flavor_notes: 'meringue layers · vanilla cream · airy crumb',
    tagline: 'Eats like dessert and breakfast at once.',
  },
  {
    id: 'tiramisu-slice',
    name: 'Tiramisu',
    kind: 'slice',
    category: 'slices',
    price_cents: 850,
    lead_time_hours: 1,
    allergens: 'eggs,dairy,gluten',
    description:
      'Vanilla biscuit soaked with espresso, milk-chocolate layers, mascarpone cream. A classic for the afternoon slow-down.',
    photo_url: ASSETS.products[1],
    in_stock: 1,
    daily_capacity: 24,
    tradition: 'italian-classic',
    flavor_notes: 'espresso biscuit · mascarpone · milk chocolate',
    tagline: 'A classic for the afternoon slow-down.',
  },
  {
    id: 'chak-chak',
    name: 'Chak-chak',
    kind: 'pastry',
    category: 'pastries',
    price_cents: 700,
    lead_time_hours: 1,
    allergens: 'eggs,dairy,gluten',
    description:
      'Crisp fried-dough nuggets bound with honey — a Central-Asian classic, perfect with tea or coffee. Sold by the cluster.',
    photo_url: ASSETS.products[4],
    in_stock: 1,
    daily_capacity: 40,
    tradition: 'central-asian',
    flavor_notes: 'fried-dough nuggets · honey bind · cluster',
    tagline: 'Steppe-honey crunch — a Kazakh classic, perfect with tea.',
  },
  {
    id: 'truffle-bites',
    name: 'Chocolate Truffle Bites',
    kind: 'pastry',
    category: 'pastries',
    price_cents: 750,
    lead_time_hours: 1,
    allergens: 'eggs,dairy,gluten,nuts',
    description:
      'Cocoa-rolled truffle bites with a hint of espresso — small, rich, dangerously poppable. Sold in pairs.',
    photo_url: ASSETS.products[5],
    in_stock: 1,
    daily_capacity: 60,
    tradition: 'french-chocolate',
    flavor_notes: 'dark cocoa · espresso · hazelnut crunch',
    tagline: 'Small, rich, dangerously poppable.',
  },
  {
    id: 'custom-birthday-cake',
    name: 'Custom Birthday Cake',
    kind: 'custom',
    category: 'custom',
    price_cents: 9500,
    lead_time_hours: 24,
    allergens: 'eggs,dairy,gluten',
    description:
      'Designed with you — flavors, fillings, message, photo or fondant. Serves 12–20. Minimum 24 hours notice; vegan or gluten-free needs 36 hours.',
    photo_url: ASSETS.products[7],
    in_stock: 1,
    daily_capacity: 4,
    tradition: 'celebration',
    flavor_notes: 'your flavors · your decoration · your inscription',
    tagline: 'Designed with you. Quoted by Askhat.',
  },
  {
    id: 'office-dessert-box',
    name: 'Office Dessert Box',
    kind: 'catering',
    category: 'catering',
    price_cents: 12000,
    lead_time_hours: 3,
    allergens: 'eggs,dairy,gluten,nuts',
    description:
      'Curated assortment for offices and gatherings — slices, rolls, mini cakes. Three hours notice for an assortment, longer for groups over fifty.',
    photo_url: ASSETS.products[9],
    in_stock: 1,
    daily_capacity: 8,
    tradition: 'catering',
    flavor_notes: 'curated assortment · slices · rolls · minis',
    tagline: 'One box, the whole greatest-hits, for the table.',
  },
  {
    id: 'morning-pastry-mix',
    name: 'Morning Pastry Mix',
    kind: 'catering',
    category: 'catering',
    price_cents: 5800,
    lead_time_hours: 3,
    allergens: 'eggs,dairy,gluten,nuts',
    description:
      'Mixed pastries and bite-size cakes — the right number of choices to keep a 10-person meeting happy.',
    photo_url: ASSETS.products[2],
    in_stock: 1,
    daily_capacity: 6,
    tradition: 'catering',
    flavor_notes: 'mini pastries · bite-size cakes · 10-person serve',
    tagline: 'The right number of choices to keep a meeting happy.',
  },
]

export function findCatalogProduct(id: string): Product | null {
  return CATALOG.find((p) => p.id === id) ?? null
}

// "Tradition" → human label + theme. Drives the showcase-card chip and the
// subtle accent gradient. Each cake stays unique on the market because it
// belongs to a clearly named family ("Kazakh-European honey-cake tradition")
// — the chip is the first thing you read on the card.
export const TRADITION_LABELS: Record<NonNullable<Product['tradition']>, { label: string; short: string }> = {
  'kazakh-european-honey': { label: 'Kazakh-European honey cake', short: 'Honey tradition' },
  'central-asian':         { label: 'Central-Asian classic',       short: 'Central Asian' },
  'italian-classic':       { label: 'Italian café classic',         short: 'Italian classic' },
  'modern-meringue':       { label: 'Modern meringue',              short: 'Meringue' },
  'french-chocolate':      { label: 'French chocolate',             short: 'French chocolate' },
  'celebration':           { label: 'Celebration cake',             short: 'Celebration' },
  'catering':              { label: 'Catering assortment',          short: 'Catering' },
}

// Display order for the menu sections. "Most popular first" so the case
// browser reads slice → whole → pastry → custom → catering.
export const KIND_ORDER: ProductKind[] = ['slice', 'whole', 'pastry', 'custom', 'catering']

export type ProductKind = 'slice' | 'whole' | 'pastry' | 'custom' | 'catering'

export const KIND_LABELS: Record<ProductKind, { plural: string; singular: string; blurb: string }> = {
  slice: {
    plural: 'By the slice',
    singular: 'Slice',
    blurb: 'Ready from the case — no notice. Grab one with your coffee.',
  },
  whole: {
    plural: 'Whole cakes',
    singular: 'Whole cake',
    blurb: 'Full cakes for the table. About an hour\'s notice for cutting and packaging.',
  },
  pastry: {
    plural: 'Pastries & bites',
    singular: 'Pastry',
    blurb: 'Small format, sold by the cluster or pair. Great with tea.',
  },
  custom: {
    plural: 'Custom orders',
    singular: 'Custom',
    blurb: 'Birthdays, anniversaries, baby showers — designed with you. 24 hours notice.',
  },
  catering: {
    plural: 'Catering & boxes',
    singular: 'Catering',
    blurb: 'Curated assortments for offices and gatherings. Three hours notice and up.',
  },
}
