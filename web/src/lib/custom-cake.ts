// Shared types + options for the /order/custom funnel. The funnel collects
// structured details, formats them into a markdown summary, and posts to the
// existing /api/orders/draft endpoint. The owner receives a draft with rich
// notes and adjusts pricing at approval — the kitchen never starts on a
// custom without a human eye.

import { z } from 'zod'

export const OCCASIONS = [
  { value: 'birthday', label: 'Birthday', icon: '🎂' },
  { value: 'anniversary', label: 'Anniversary', icon: '💍' },
  { value: 'wedding', label: 'Wedding', icon: '🤍' },
  { value: 'baby-shower', label: 'Baby shower', icon: '🍼' },
  { value: 'graduation', label: 'Graduation', icon: '🎓' },
  { value: 'corporate', label: 'Corporate event', icon: '🏢' },
  { value: 'other', label: 'Something else', icon: '✨' },
] as const

export const SERVINGS = [
  { value: '6-10', label: '6 – 10', subtitle: 'Small gathering' },
  { value: '10-15', label: '10 – 15', subtitle: 'Family + a few friends' },
  { value: '15-25', label: '15 – 25', subtitle: 'Mid-size party' },
  { value: '25-40', label: '25 – 40', subtitle: 'Big celebration' },
  { value: '40+', label: '40+', subtitle: 'Tell us the headcount' },
] as const

// Flavor pick maps to a placeholder SKU on /api/orders/draft so the backend
// can create a draft. Owner adjusts price + recipe at approval.
export const FLAVORS = [
  { value: 'vanilla', label: 'Classic vanilla', sku: 'sku-classic-1kg' },
  { value: 'chocolate', label: 'Chocolate truffle', sku: 'sku-choco-1kg' },
  { value: 'honey', label: 'Honey cake', sku: 'sku-classic-1kg' },
  { value: 'red-velvet', label: 'Red velvet', sku: 'sku-vegan-1kg' },
  { value: 'pistachio', label: 'Pistachio', sku: 'sku-classic-1kg' },
  { value: 'ask-us', label: 'Help me decide', sku: 'sku-classic-1kg' },
] as const

export const DIETARY_TAGS = [
  { value: 'gluten-free', label: 'Gluten-free' },
  { value: 'no-nuts', label: 'No tree nuts' },
  { value: 'dairy-free', label: 'Dairy-free' },
  { value: 'egg-free', label: 'Egg-free' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'halal', label: 'Halal-friendly' },
] as const

export const customCakeSchema = z.object({
  occasion: z.string().min(1, 'Pick an occasion'),
  servings: z.string().min(1, 'How many people?'),
  flavor: z.string().min(1, 'Pick a flavor'),
  color_theme: z.string().optional(),
  inscription: z.string().max(50, 'Keep it short — fits the cake top').optional(),
  dietary_tags: z.array(z.string()).default([]),
  reference_photo_urls: z.array(z.string().url()).max(5).default([]),
  scheduled_at_iso: z.string().min(1, 'When would you like it?'),
  pickup_or_delivery: z.enum(['pickup', 'delivery']),
  customer_name: z.string().min(1, 'Your name'),
  customer_phone: z.string().min(7, 'Phone number'),
  customer_email: z.string().email('Email looks off').optional().or(z.literal('')),
  notes: z.string().max(500).optional(),
})

export type CustomCakeValues = z.infer<typeof customCakeSchema>

// Compose a kitchen-ticket-friendly markdown summary the owner sees in the
// approval queue. Keeps the brand voice plain and the structure scannable.
export function formatCustomSpec(v: CustomCakeValues): string {
  const lines: string[] = ['CUSTOM CAKE REQUEST']
  lines.push('')
  lines.push(`Occasion:   ${labelFor(OCCASIONS, v.occasion)}`)
  lines.push(`Servings:   ${labelFor(SERVINGS, v.servings)}`)
  lines.push(`Flavor:     ${labelFor(FLAVORS, v.flavor)}`)
  if (v.color_theme) lines.push(`Color:      ${v.color_theme}`)
  if (v.inscription) lines.push(`Inscription: "${v.inscription}"`)
  if (v.dietary_tags.length > 0) {
    const tags = v.dietary_tags.map((t) => labelFor(DIETARY_TAGS, t)).join(', ')
    lines.push(`Dietary:    ${tags}`)
  }
  lines.push('')
  lines.push(`When:       ${new Date(v.scheduled_at_iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`)
  lines.push(`Method:     ${v.pickup_or_delivery}`)
  lines.push(`Customer:   ${v.customer_name}`)
  lines.push(`Phone:      ${v.customer_phone}`)
  if (v.customer_email) lines.push(`Email:      ${v.customer_email}`)
  if (v.reference_photo_urls && v.reference_photo_urls.length > 0) {
    lines.push('')
    lines.push('Reference photos:')
    for (const url of v.reference_photo_urls) lines.push(`  ${url}`)
  }
  if (v.notes) {
    lines.push('')
    lines.push('Customer notes:')
    lines.push(v.notes)
  }
  return lines.join('\n')
}

export function flavorToSku(flavor: string): string {
  return FLAVORS.find((f) => f.value === flavor)?.sku ?? FLAVORS[0].sku
}

function labelFor<T extends ReadonlyArray<{ value: string; label: string }>>(
  arr: T,
  value: string,
): string {
  return arr.find((x) => x.value === value)?.label ?? value
}
