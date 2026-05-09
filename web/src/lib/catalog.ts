// Canonical Happy Cake catalog — mirrors docs/00-source/SNAPSHOT.md (the
// sandbox MCP `square_list_catalog` snapshot) and pairs each product with
// an approved photo from the asset pack. The website prefers this catalog
// over whatever the backend's local SQLite seed contains: that seed has
// generic placeholder SKUs (sku-classic-1kg, etc.) until the backend
// imports the real catalog.
//
// When the backend's seed catches up, this list can be retired or used
// only as a fallback. For now: source of truth for what /menu shows.

import { ASSETS } from './brand'
import type { Product } from './api'

export const CATALOG: Product[] = [
  {
    id: 'honey-cake-slice',
    name: 'Honey Cake (slice)',
    category: 'slices',
    price_cents: 850,
    lead_time_hours: 1,
    allergens: 'eggs,dairy,gluten',
    description:
      'Our signature — six layers of golden honey biscuit, soft custard between every one, walnuts on top. Same recipe as the day we opened.',
    photo_url: ASSETS.products[0],
    in_stock: 1,
    daily_capacity: 80,
  },
  {
    id: 'whole-honey-cake',
    name: 'Whole Honey Cake',
    category: 'whole-cakes',
    price_cents: 5500,
    lead_time_hours: 1,
    allergens: 'eggs,dairy,gluten',
    description:
      'The full honey-cake experience — feeds about a dozen. Hand-decorated, hand-packed. About an hour\'s notice for cutting and packaging.',
    photo_url: ASSETS.products[6],
    in_stock: 1,
    daily_capacity: 12,
  },
  {
    id: 'pistachio-roll',
    name: 'Pistachio Roll',
    category: 'slices',
    price_cents: 950,
    lead_time_hours: 1,
    allergens: 'eggs,dairy,gluten,nuts',
    description:
      'Light meringue rolled with pistachio cream and the sour-sweet of fresh raspberry. By the slice, fresh from the case.',
    photo_url: ASSETS.products[3],
    in_stock: 1,
    daily_capacity: 30,
  },
  {
    id: 'cloud-cake-slice',
    name: 'Cloud Cake (slice)',
    category: 'slices',
    price_cents: 900,
    lead_time_hours: 1,
    allergens: 'eggs,dairy,gluten',
    description:
      'Light, airy layers of meringue and delicate vanilla cream. Our most-loved seasonal slice — eats like dessert and breakfast at once.',
    photo_url: ASSETS.products[8],
    in_stock: 1,
    daily_capacity: 25,
  },
  {
    id: 'tiramisu-slice',
    name: 'Tiramisu (slice)',
    category: 'slices',
    price_cents: 850,
    lead_time_hours: 1,
    allergens: 'eggs,dairy,gluten',
    description:
      'Vanilla biscuit soaked with espresso, milk-chocolate layers, mascarpone cream. A classic for the afternoon slow-down.',
    photo_url: ASSETS.products[1],
    in_stock: 1,
    daily_capacity: 24,
  },
  {
    id: 'chak-chak',
    name: 'Chak-chak',
    category: 'pastries',
    price_cents: 700,
    lead_time_hours: 1,
    allergens: 'eggs,dairy,gluten',
    description:
      'Crisp fried-dough nuggets bound with honey — a Central-Asian classic, perfect with tea or coffee. Sold by the cluster.',
    photo_url: ASSETS.products[4],
    in_stock: 1,
    daily_capacity: 40,
  },
  {
    id: 'truffle-bites',
    name: 'Chocolate Truffle Bites',
    category: 'pastries',
    price_cents: 750,
    lead_time_hours: 1,
    allergens: 'eggs,dairy,gluten,nuts',
    description:
      'Cocoa-rolled truffle bites with a hint of espresso — small, rich, dangerously poppable. Sold in pairs.',
    photo_url: ASSETS.products[5],
    in_stock: 1,
    daily_capacity: 60,
  },
  {
    id: 'custom-birthday-cake',
    name: 'Custom Birthday Cake',
    category: 'custom',
    price_cents: 9500,
    lead_time_hours: 24,
    allergens: 'eggs,dairy,gluten',
    description:
      'Designed with you — flavors, fillings, message, photo or fondant. Serves 12–20. Minimum 24 hours notice; vegan or gluten-free needs 36 hours.',
    photo_url: ASSETS.products[7],
    in_stock: 1,
    daily_capacity: 4,
  },
  {
    id: 'office-dessert-box',
    name: 'Office Dessert Box',
    category: 'catering',
    price_cents: 12000,
    lead_time_hours: 3,
    allergens: 'eggs,dairy,gluten,nuts',
    description:
      'Curated assortment for offices and gatherings — slices, rolls, mini cakes. Three hours notice for an assortment, longer for groups over fifty.',
    photo_url: ASSETS.products[9],
    in_stock: 1,
    daily_capacity: 8,
  },
  {
    id: 'morning-pastry-mix',
    name: 'Morning Pastry Mix',
    category: 'catering',
    price_cents: 5800,
    lead_time_hours: 3,
    allergens: 'eggs,dairy,gluten,nuts',
    description:
      'Mixed pastries and bite-size cakes — the right number of choices to keep a 10-person meeting happy.',
    photo_url: ASSETS.products[2],
    in_stock: 1,
    daily_capacity: 6,
  },
]

export function findCatalogProduct(id: string): Product | null {
  return CATALOG.find((p) => p.id === id) ?? null
}
