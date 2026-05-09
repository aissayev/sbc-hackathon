// Widget-side data: a curated FAQ subset that doesn't require the user
// to leave the widget, and the order-status step labels reused from the
// /order/confirm page. Heavier copy stays on /policies + /dietary; the
// widget is for quick answers.

export interface WidgetFaq {
  q: string
  a: string
}

export const WIDGET_FAQ: WidgetFaq[] = [
  {
    q: 'How fast can you have a cake ready?',
    a: 'Slices are usually in the case right now. Whole cakes need about an hour. Custom cakes need 24 hours minimum (36 for vegan or gluten-free).',
  },
  {
    q: 'Do you deliver?',
    a: 'Yes — across Sugar Land and the Houston metro. Pickup from our shop is free. Delivery fee depends on distance and is confirmed at order time.',
  },
  {
    q: 'How do I cancel an order?',
    a: 'Cancel free up to 24 hours before. After that, the cake is already started — late cancellations are charged in full. Message us as early as you can.',
  },
  {
    q: 'What allergens are in your cakes?',
    a: 'Our kitchen handles eggs, dairy, gluten, and tree nuts in shared spaces. Every cake has at least one of these. For severe allergies, message us first.',
  },
  {
    q: 'Are your cakes halal-friendly?',
    a: 'Most of them — no alcohol, no pork-derived ingredients. The honey cake, milk maiden, and pistachio roll are always halal-friendly. Tell us when you order.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'Card via Square at confirmation, cash at pickup, or Zelle. We don\'t store card details on the website.',
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
