// Widget-side data: a curated FAQ subset that doesn't require the user
// to leave the widget, and the order-status step labels reused from the
// /order/confirm page. Heavier copy stays on /policies + /dietary; the
// widget is for quick answers.

export interface WidgetFaq {
  q: string
  a: string
}

// Collections group FAQs into Intercom-style "topics" so the Help tab
// reads as a directory rather than a flat list. A collection may also
// expose a `cta` — used for topics where the answer isn't a Q&A but a
// dedicated flow (custom cakes, B2B intake).
export interface WidgetCollection {
  id: string
  title: string
  description: string
  icon: 'package' | 'allergens' | 'truck' | 'sparkles' | 'building' | 'card'
  faqs: WidgetFaq[]
  cta?: { label: string; href: string; subtitle?: string }
}

export const WIDGET_COLLECTIONS: WidgetCollection[] = [
  {
    id: 'lead-times',
    title: 'Lead times & cancellations',
    description: 'How fast we can have a cake ready, and our cancellation policy.',
    icon: 'package',
    faqs: [
      {
        q: 'How fast can you have a cake ready?',
        a: 'Slices are usually in the case right now. Whole cakes need about an hour. Custom cakes need 24 hours minimum (36 for vegan or gluten-free).',
      },
      {
        q: 'How do I cancel an order?',
        a: 'Cancel free up to 24 hours before. After that, the cake is already started — late cancellations are charged in full. Message us as early as you can.',
      },
    ],
  },
  {
    id: 'allergens',
    title: 'Allergens & diets',
    description: 'What\'s in our kitchen, halal-friendly options, severe-allergy guidance.',
    icon: 'allergens',
    faqs: [
      {
        q: 'What allergens are in your cakes?',
        a: 'Our kitchen handles eggs, dairy, gluten, and tree nuts in shared spaces. Every cake has at least one of these. For severe allergies, message us first.',
      },
      {
        q: 'Are your cakes halal-friendly?',
        a: 'Most of them — no alcohol, no pork-derived ingredients. The honey cake, milk maiden, and pistachio roll are always halal-friendly. Tell us when you order.',
      },
    ],
  },
  {
    id: 'delivery',
    title: 'Pickup & delivery',
    description: 'Where we deliver, fees, and how pickup works.',
    icon: 'truck',
    faqs: [
      {
        q: 'Do you deliver?',
        a: 'Yes — across Sugar Land and the Houston metro. Pickup from our shop is free. Delivery fee depends on distance and is confirmed at order time.',
      },
    ],
  },
  {
    id: 'custom',
    title: 'Custom cakes',
    description: 'Birthday, wedding, themed — five quick steps then Askhat quotes.',
    icon: 'sparkles',
    faqs: [],
    cta: {
      label: 'Start a custom order',
      href: '/order/custom',
      subtitle: 'Five steps · ~3 minutes',
    },
  },
  {
    id: 'business',
    title: 'For business',
    description: 'Catering, gifting, standing programs. We reply within one business day.',
    icon: 'building',
    faqs: [],
    cta: {
      label: 'Open the business intake',
      href: '/business',
      subtitle: 'Companies, venues, event planners',
    },
  },
  {
    id: 'payment',
    title: 'Payments & receipts',
    description: 'How you pay and what we accept.',
    icon: 'card',
    faqs: [
      {
        q: 'What payment methods do you accept?',
        a: 'Card via Square at confirmation, cash at pickup, or Zelle. We don\'t store card details on the website.',
      },
    ],
  },
]

export const ORDER_STATUS_LABEL: Record<string, { label: string; tone: 'sky' | 'sage' | 'berry' | 'cocoa' }> = {
  draft: { label: 'Sent — awaiting Askhat', tone: 'sky' },
  approved: { label: 'Approved — in the kitchen', tone: 'sky' },
  in_kitchen: { label: 'Baking', tone: 'sky' },
  ready: { label: 'Ready for pickup', tone: 'sage' },
  out_for_delivery: { label: 'On the way', tone: 'sage' },
  completed: { label: 'Completed', tone: 'sage' },
  rejected: { label: 'Cannot fulfill', tone: 'berry' },
  cancelled: { label: 'Cancelled', tone: 'berry' },
}
