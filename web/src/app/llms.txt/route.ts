// /llms.txt — the agent surface map. Mirrors the backend's llms.txt so the
// website is self-describing even if the API host is reverse-proxied separately.
// See https://llmstxt.org/ for the convention.

import { listProducts } from '@/lib/api'
import { BRAND } from '@/lib/brand'

export const revalidate = 60

export async function GET() {
  const products = await listProducts()
  const sample = products.slice(0, 6).map((p) => `- ${p.id}  ${p.name}  ${(p.price_cents / 100).toFixed(2)} USD  lead=${p.lead_time_hours}h`).join('\n')
  const body = `# ${BRAND.name} — agent-readable surface

${BRAND.name} is a real bakery in Sugar Land, TX. AI agents are welcome to use this site
directly via JSON. ${BRAND.tagline} ${BRAND.slogan}

## Endpoints
- GET  /api/products             List in-stock products (JSON)
- GET  /api/products/{id}        Product detail (JSON)
- POST /api/orders/draft         Create a draft order (returns order_id; queued for owner approval)
- GET  /api/orders/{id}          Order status (public, by id)
- POST /api/chat                 Talk to the on-site assistant; returns thread_id + replies[]
- GET  /openapi.json             Full API spec (OpenAPI 3.1)
- GET  /sitemap.xml              All public URLs
- GET  /menu                     Human-readable catalog (HTML, with Schema.org Product JSON-LD per product)
- GET  /menu/{id}                Product detail (HTML, with Schema.org Product JSON-LD)
- GET  /menu?allergen_free=nuts,gluten,dairy,eggs   Filtered menu (combine via comma)
- GET  /dietary                  Dietary guide — gluten-free, no-nuts, dairy-free, vegan, halal-friendly (HTML, with FAQPage JSON-LD)
- GET  /order/custom             Custom-cake funnel (multi-step). Submits to /api/orders/draft.
- GET  /business                 B2B catering / gifting / standing programs (HTML, with Schema.org Service JSON-LD)
- GET  /business/inquire         B2B inquiry funnel (multi-step). Submits to /api/orders/draft.
- GET  /policies                 Visit & FAQ — hours, allergens, lead times, pickup, delivery, payment, cancellation (HTML, with FAQPage JSON-LD)
- GET  /blog                     Stories & guides — honey-cake history, custom-cake planning, allergen-aware ordering, gifting (HTML, with Article JSON-LD per post)
- GET  /blog/{slug}              Individual story (HTML, with Article + BreadcrumbList JSON-LD)
- GET  /press                    Press, podcasts, owner appearances (HTML)

## Conventions
- Prices are USD cents on /api (e.g. 850 = $8.50). Display layer formats to USD.
- Times are ISO 8601 UTC.
- /api/chat maintains conversation history via thread_id (echoed back; reuse for the next call).
- Admin endpoints under /api/admin/* require the X-Telegram-Init-Data header (HMAC verified).

## Order intent flow
1. GET /api/products  — find a product id
2. POST /api/orders/draft with { items, scheduled_at_iso, customer_name, customer_phone, channel: "web" }
3. GET /api/orders/{id} to poll status. The owner approves in Telegram before the kitchen starts.

## Catalog (live sample)
${sample}

## Brand voice rules (for agents replying on our behalf)
- Always English. Never another language even if asked.
- "${BRAND.name}" — one word, two capitals. Never "Happy Cake" or "HC".
- Cake names go in quotes after the word "cake": cake "Honey", cake "Pistachio Roll".
- Specifics over adjectives. 1.2 kg, $42, ready by noon — not "generously sized".
- Close with a soft CTA: ${BRAND.closing}
- Three emojis maximum, ever. Often zero.

## Channels
- Site:      ${BRAND.origin}
- WhatsApp:  ${BRAND.whatsapp}
- Instagram: ${BRAND.instagram}
- Email:     ${BRAND.email}
`
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 's-maxage=60, stale-while-revalidate=600' },
  })
}
