// B2B inquiry — types, options, and a notes formatter. The submission goes
// to /api/orders/draft with a placeholder item until the backend exposes a
// proper b2b_leads table; the rich `notes` field carries the structured spec
// so the owner can triage from Telegram + the admin queue.

import { z } from 'zod'

// Icon is a Lucide name (resolved by the form) rather than an OS emoji.
// The brand book's icon vocabulary is "single-stroke", so consistent
// line icons read cleaner on cream than the platform-rendered emoji
// (which look like Apple stickers on Apple, Microsoft Fluent on
// Windows, etc.).
export const INQUIRY_TYPES = [
  {
    value: 'office',
    label: 'Office breaks',
    icon: 'coffee',
    body: 'Daily or weekly assortments for your team — slices, pastries, coffee on the side.',
  },
  {
    value: 'event',
    label: 'One-time event',
    icon: 'sparkles',
    body: 'Birthdays, milestones, conference catering, holiday parties, off-sites.',
  },
  {
    value: 'gifting',
    label: 'Corporate gifting',
    icon: 'gift',
    body: 'Welcome boxes for new hires, client gifts, year-end appreciation drops.',
  },
  {
    value: 'custom',
    label: 'Standing program',
    icon: 'repeat',
    body: 'Quarterly cadence, recurring deliveries, wholesale resale — let\'s talk.',
  },
] as const

export type InquiryIcon = (typeof INQUIRY_TYPES)[number]['icon']

export const HEADCOUNTS = [
  { value: '5-15', label: '5 – 15' },
  { value: '15-40', label: '15 – 40' },
  { value: '40-100', label: '40 – 100' },
  { value: '100-250', label: '100 – 250' },
  { value: '250+', label: '250+' },
] as const

export const CADENCES = [
  { value: 'one-off', label: 'One time' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every other week' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
] as const

export const BUDGETS = [
  { value: '<500', label: 'Under $500' },
  { value: '500-1500', label: '$500 – $1,500' },
  { value: '1500-5000', label: '$1,500 – $5,000' },
  { value: '5000+', label: '$5,000+' },
  { value: 'flexible', label: 'Flexible — quote me' },
] as const

export const DIETARY_NEEDS = [
  { value: 'gluten-free', label: 'Gluten-free' },
  { value: 'no-nuts', label: 'No tree nuts' },
  { value: 'dairy-free', label: 'Dairy-free' },
  { value: 'egg-free', label: 'Egg-free' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'halal', label: 'Halal-friendly' },
] as const

export const PACKAGES = [
  {
    slug: 'office-breaks',
    name: 'Office breaks',
    starting_at: 'from $4.50 / head',
    body:
      'Daily or weekly assortments for your team — slices, pastries, coffee on the side. Standing orders save 10%.',
    bullets: [
      'Daily / weekly delivery to your office',
      'Mixed assortment, rotating weekly',
      'Dedicated point of contact, single invoice',
    ],
  },
  {
    slug: 'events',
    name: 'Events',
    starting_at: 'from $250 per cake',
    body:
      'Birthdays, milestones, holiday parties, conferences. Custom-decorated cakes + dessert tables for 15-250 guests.',
    bullets: [
      'Custom design + inscription',
      'Dietary-friendly add-ons',
      '24-hour standard, 48-hour for peak weekends',
    ],
  },
  {
    slug: 'gifting',
    name: 'Corporate gifting',
    starting_at: 'from $35 / box',
    body:
      'Welcome boxes for new hires, client gifts, year-end appreciation drops. Branded ribbon, hand-written cards, batch delivery.',
    bullets: [
      'Branded packaging + handwritten note',
      'Batch delivery with single PO',
      'White-glove handoff for VIPs',
    ],
  },
] as const

export const b2bSchema = z.object({
  type: z.string().min(1, 'Pick a fit'),
  headcount: z.string().min(1, 'How many people?'),
  cadence: z.string().min(1, 'How often?'),
  first_date: z.string().min(1, 'First date?'),
  budget: z.string().min(1, 'Budget band?'),
  dietary: z.array(z.string()).default([]),
  contact_name: z.string().min(1, 'Your name'),
  contact_email: z.string().email('Email looks off'),
  contact_phone: z.string().optional(),
  company: z.string().min(1, 'Company name'),
  notes: z.string().max(800).optional(),
})

export type B2BValues = z.infer<typeof b2bSchema>

// Compose the inquiry as a structured note. The owner sees this in their
// approval queue. Plain English on purpose — it's a brief, not a form dump.
export function formatB2BSpec(v: B2BValues): string {
  const lines: string[] = ['B2B INQUIRY']
  lines.push('')
  lines.push(`Fit:        ${labelFor(INQUIRY_TYPES, v.type)}`)
  lines.push(`Headcount:  ${labelFor(HEADCOUNTS, v.headcount)}`)
  lines.push(`Cadence:    ${labelFor(CADENCES, v.cadence)}`)
  lines.push(`First date: ${new Date(v.first_date).toLocaleDateString('en-US', { dateStyle: 'medium' })}`)
  lines.push(`Budget:     ${labelFor(BUDGETS, v.budget)}`)
  if (v.dietary.length > 0) {
    lines.push(`Dietary:    ${v.dietary.map((d) => labelFor(DIETARY_NEEDS, d)).join(', ')}`)
  }
  lines.push('')
  lines.push(`Company:    ${v.company}`)
  lines.push(`Contact:    ${v.contact_name}`)
  lines.push(`Email:      ${v.contact_email}`)
  if (v.contact_phone) lines.push(`Phone:      ${v.contact_phone}`)
  if (v.notes) {
    lines.push('')
    lines.push('Notes:')
    lines.push(v.notes)
  }
  return lines.join('\n')
}

function labelFor<T extends ReadonlyArray<{ value: string; label: string }>>(
  arr: T,
  value: string,
): string {
  return arr.find((x) => x.value === value)?.label ?? value
}
