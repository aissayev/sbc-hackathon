// Server-rendered HTML pages. No build step, no JS framework. Tailwind via CDN.
// Per BRANDBOOK.md: cream + Happy Blue palette, Cormorant Garamond display.
//
// What each page is for:
//   /         brand-led hero, signposts to menu + chat
//   /menu     full catalog with prices, lead times, allergens (Agent-Friendliness)
//   /menu/:id product detail with Schema.org Product JSON-LD
//   /policies allergens, cancellation, fulfillment, payment
//   /chat     embedded on-site assistant (POSTs to /api/chat)
//   /openapi.json  agent-readable API spec

import { layout, escapeHtml, BRAND } from './layout.ts'
import type { Product } from '../domain/tools.ts'

const fmtUsd = (cents: number) => `$${(cents / 100).toFixed(2).replace(/\.00$/, '')}`

function leadTimeLabel(hours: number): string {
  if (hours < 1) return 'Right now from the case'
  if (hours === 1) return '~1 hour notice'
  if (hours < 24) return `${hours} hours notice`
  return `${Math.round(hours / 24)} day${hours >= 48 ? 's' : ''} notice`
}

export function home(): string {
  const body = `
<section class="text-center py-12">
  <p class="text-sm tracking-widest text-happy-700 uppercase">◆ HappyCake · Sugar Land</p>
  <h1 class="font-display text-5xl mt-4 text-happy-900">${BRAND.tagline}</h1>
  <p class="mt-3 text-lg text-happy-900/80">${BRAND.slogan}</p>
  <div class="mt-8 flex gap-3 justify-center">
    <a href="/menu" class="px-5 py-3 bg-happy-700 text-cream-50 rounded-md font-medium">See the menu</a>
    <a href="/chat" class="px-5 py-3 border border-happy-700 text-happy-700 rounded-md font-medium">Chat with us</a>
  </div>
</section>

<section class="mt-16 grid sm:grid-cols-3 gap-6">
  <div class="p-6 bg-cream-100 rounded-lg">
    <h3 class="font-display text-2xl text-happy-900">Real cakes</h3>
    <p class="mt-2 text-happy-900/80">Made by hand in our Sugar Land kitchen. Every cake is hand-decorated and hand-packed.</p>
  </div>
  <div class="p-6 bg-cream-100 rounded-lg">
    <h3 class="font-display text-2xl text-happy-900">Honest about today</h3>
    <p class="mt-2 text-happy-900/80">If a cake takes 24 hours, we say 24 hours. If a slice is sold out, we say so. No false promises.</p>
  </div>
  <div class="p-6 bg-cream-100 rounded-lg">
    <h3 class="font-display text-2xl text-happy-900">Order how you like</h3>
    <p class="mt-2 text-happy-900/80">Site, WhatsApp, or Instagram DM. Same record, same cake, same care.</p>
  </div>
</section>

<section class="mt-16 text-center py-10 bg-happy-900 text-cream-50 rounded-lg">
  <p class="font-display text-3xl">Today's bake is out — pick yours up by 7 PM.</p>
  <a href="/menu" class="mt-4 inline-block underline">See what's in the case →</a>
</section>
`
  return layout({
    title: 'Home',
    description: `${BRAND.tagline} ${BRAND.slogan} — HappyCake, Sugar Land TX.`,
    body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Bakery',
      name: 'HappyCake',
      description: BRAND.tagline,
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Sugar Land',
        addressRegion: 'TX',
        addressCountry: 'US',
      },
      url: 'https://happycake.us',
      sameAs: ['https://instagram.com/happycake.us'],
    },
  })
}

export function menu(products: Product[]): string {
  const cards = products
    .map(
      (p) => `
<article class="p-6 bg-white border border-happy-700/20 rounded-lg">
  <h3 class="font-display text-2xl text-happy-900">${escapeHtml(p.name)}</h3>
  <p class="text-happy-900/80 mt-2 text-sm">${escapeHtml(p.description ?? '')}</p>
  <div class="mt-4 flex items-end justify-between">
    <div>
      <div class="text-2xl font-medium text-happy-900">${fmtUsd(p.price_cents)}</div>
      <div class="text-xs text-happy-900/60">${leadTimeLabel(p.lead_time_hours)}</div>
    </div>
    <a href="/menu/${escapeHtml(p.id)}" class="text-happy-700 text-sm hover:underline">Details →</a>
  </div>
  ${
    p.allergens
      ? `<div class="mt-3 flex flex-wrap gap-1.5">${p.allergens
          .split(',')
          .map((a) => `<span class="text-xs px-2 py-0.5 bg-cream-200 text-happy-900 rounded">${escapeHtml(a.trim())}</span>`)
          .join('')}</div>`
      : ''
  }
</article>
`,
    )
    .join('')
  const body = `
<section>
  <p class="text-sm tracking-widest text-happy-700 uppercase">◆ Today's menu</p>
  <h1 class="font-display text-4xl mt-2 text-happy-900">What's in the case</h1>
  <p class="mt-2 text-happy-900/80 max-w-xl">${BRAND.closing}</p>
</section>
<section class="mt-10 grid sm:grid-cols-2 gap-5">
${cards}
</section>
`
  return layout({
    title: 'Menu',
    description: `Today's HappyCake menu — slices, whole cakes, custom orders. ${products.length} items.`,
    body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: products.map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `https://happycake.us/menu/${p.id}`,
        name: p.name,
      })),
    },
  })
}

export function productDetail(p: Product): string {
  const body = `
<nav class="text-sm text-happy-900/60"><a href="/menu" class="hover:underline">← Menu</a></nav>
<article class="mt-6 grid md:grid-cols-2 gap-10">
  <div>
    ${p.photo_url ? `<img src="${escapeHtml(p.photo_url)}" alt="${escapeHtml(p.name)}" class="w-full rounded-lg" />` : `<div class="w-full aspect-square bg-cream-100 rounded-lg flex items-center justify-center text-happy-900/40">photo on the way</div>`}
  </div>
  <div>
    <p class="text-sm tracking-widest text-happy-700 uppercase">${escapeHtml(p.category)}</p>
    <h1 class="font-display text-4xl mt-2 text-happy-900">${escapeHtml(p.name)}</h1>
    <p class="mt-3 text-happy-900/80">${escapeHtml(p.description ?? '')}</p>
    <dl class="mt-6 space-y-2 text-sm">
      <div class="flex justify-between border-b border-happy-700/10 pb-2"><dt class="text-happy-900/60">Price</dt><dd class="font-medium">${fmtUsd(p.price_cents)}</dd></div>
      <div class="flex justify-between border-b border-happy-700/10 pb-2"><dt class="text-happy-900/60">Lead time</dt><dd>${leadTimeLabel(p.lead_time_hours)}</dd></div>
      ${p.daily_capacity ? `<div class="flex justify-between border-b border-happy-700/10 pb-2"><dt class="text-happy-900/60">Daily capacity</dt><dd>${p.daily_capacity}/day</dd></div>` : ''}
      ${p.allergens ? `<div class="flex justify-between border-b border-happy-700/10 pb-2"><dt class="text-happy-900/60">Allergens</dt><dd>${escapeHtml(p.allergens)}</dd></div>` : ''}
    </dl>
    <a href="/chat?product=${escapeHtml(p.id)}" class="mt-8 inline-block px-5 py-3 bg-happy-700 text-cream-50 rounded-md font-medium">Start an order</a>
    <p class="mt-3 text-xs text-happy-900/60">${BRAND.closing}</p>
  </div>
</article>
`
  return layout({
    title: p.name,
    description: p.description ?? p.name,
    body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: p.name,
      description: p.description,
      image: p.photo_url ? [`https://happycake.us${p.photo_url}`] : undefined,
      brand: { '@type': 'Brand', name: 'HappyCake' },
      offers: {
        '@type': 'Offer',
        url: `https://happycake.us/menu/${p.id}`,
        priceCurrency: 'USD',
        price: (p.price_cents / 100).toFixed(2),
        availability: p.in_stock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      },
      additionalProperty: [
        { '@type': 'PropertyValue', name: 'lead_time_hours', value: p.lead_time_hours },
        ...(p.allergens
          ? [{ '@type': 'PropertyValue', name: 'allergens', value: p.allergens }]
          : []),
      ],
    },
  })
}

export function policies(): string {
  const body = `
<section>
  <p class="text-sm tracking-widest text-happy-700 uppercase">◆ Policies</p>
  <h1 class="font-display text-4xl mt-2 text-happy-900">Allergens, lead times, cancellations</h1>
  <p class="mt-2 text-happy-900/80 max-w-xl">Plain English. If something here is unclear, send us a message — we'll explain it the way we'd explain it to a neighbour.</p>
</section>

<section class="mt-10 space-y-8 max-w-3xl">
  <div>
    <h2 class="font-display text-2xl text-happy-900">Lead times</h2>
    <ul class="mt-2 list-disc list-inside text-happy-900/90">
      <li>Slices, rolls — usually ready from the case. About an hour's notice if we're out.</li>
      <li>Whole honey cake — about an hour for cutting and packaging.</li>
      <li>Custom birthday cakes — minimum 24 hours so we can design and bake.</li>
      <li>Office dessert boxes — 3 hours for an assortment, longer for groups over 50.</li>
    </ul>
  </div>

  <div>
    <h2 class="font-display text-2xl text-happy-900">Allergens</h2>
    <p class="mt-2 text-happy-900/90">Our kitchen handles eggs, dairy, gluten, and tree nuts in shared spaces. Every cake we make has at least one of these. If you have a severe allergy, message us and we'll talk you through what we can and can't do safely.</p>
  </div>

  <div>
    <h2 class="font-display text-2xl text-happy-900">Pickup &amp; delivery</h2>
    <ul class="mt-2 list-disc list-inside text-happy-900/90">
      <li>Pickup is free — at our Sugar Land kitchen.</li>
      <li>Local delivery available across Sugar Land and the Houston metro. Fee depends on distance, confirmed at order time.</li>
      <li>We don't ship cakes — they're not the same after a day in transit.</li>
    </ul>
  </div>

  <div>
    <h2 class="font-display text-2xl text-happy-900">Payment</h2>
    <p class="mt-2 text-happy-900/90">Card via Square at confirmation, cash at pickup, or Zelle.</p>
  </div>

  <div>
    <h2 class="font-display text-2xl text-happy-900">Cancellation</h2>
    <p class="mt-2 text-happy-900/90">Cancel free up to 24 hours before. After that, we've already started the cake — late cancellations are charged in full. We're sorry, but we can't sell a baked cake to anyone else.</p>
  </div>
</section>
`
  return layout({ title: 'Policies', description: 'Allergens, lead times, pickup, payment, cancellation.', body })
}

export function chat(): string {
  const body = `
<section>
  <p class="text-sm tracking-widest text-happy-700 uppercase">◆ Chat with us</p>
  <h1 class="font-display text-4xl mt-2 text-happy-900">We're listening</h1>
  <p class="mt-2 text-happy-900/80 max-w-xl">Ask anything — what's in the case today, allergens, custom cakes, status of an order. Real cake people, real-time.</p>
</section>
<section id="chat-app" class="mt-8 max-w-2xl bg-white border border-happy-700/20 rounded-lg overflow-hidden">
  <div id="chat-log" class="p-4 space-y-3 h-96 overflow-y-auto"></div>
  <form id="chat-form" class="border-t border-happy-700/20 p-3 flex gap-2">
    <input id="chat-input" autocomplete="off" placeholder="What can we help with?" class="flex-1 px-3 py-2 border border-happy-700/20 rounded outline-none focus:border-happy-500" />
    <button class="px-4 py-2 bg-happy-700 text-cream-50 rounded font-medium">Send</button>
  </form>
</section>

<script>
(() => {
  const log = document.getElementById('chat-log');
  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-input');
  let threadId = sessionStorage.getItem('hc_thread') || null;

  const params = new URLSearchParams(location.search);
  const seedProduct = params.get('product');

  function add(role, text) {
    const div = document.createElement('div');
    div.className = role === 'user' ? 'text-right' : '';
    div.innerHTML = '<div class="inline-block max-w-[80%] px-3 py-2 rounded-lg ' +
      (role === 'user' ? 'bg-happy-700 text-cream-50' : 'bg-cream-100') +
      '">' + escapeHtml(text) + '</div>';
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  async function send(text) {
    add('user', text);
    const typing = document.createElement('div');
    typing.className = 'text-happy-900/50 text-sm';
    typing.textContent = '…thinking';
    log.appendChild(typing);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thread_id: threadId, text }),
      });
      const data = await res.json();
      threadId = data.thread_id;
      sessionStorage.setItem('hc_thread', threadId);
      typing.remove();
      for (const r of (data.replies || [])) add('assistant', r);
    } catch (e) {
      typing.remove();
      add('assistant', "Sorry — connection hiccup. Try again?");
    }
  }
  form.addEventListener('submit', e => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    send(text);
  });
  if (seedProduct) {
    add('assistant', "Hi — looking at " + seedProduct.replace(/-/g,' ') + "? Tell me when you'd like it.");
  } else {
    add('assistant', "Hi! What can we help with — a slice, a whole cake, or something custom?");
  }
})();
</script>
`
  return layout({ title: 'Chat', description: 'Talk to HappyCake — real-time assistant for orders, allergens, custom cakes, and more.', body })
}

export function openApiSpec(): object {
  return {
    openapi: '3.1.0',
    info: { title: 'HappyCake API', version: '0.1.0', description: 'Customer-facing API for AI agents and humans.' },
    servers: [{ url: 'https://happycake.us', description: 'Production (placeholder)' }],
    paths: {
      '/api/products': {
        get: {
          summary: 'List in-stock products',
          responses: { '200': { description: 'array of products' } },
        },
      },
      '/api/products/{id}': {
        get: {
          summary: 'Product detail',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'product detail' }, '404': { description: 'not found' } },
        },
      },
      '/api/chat': {
        post: {
          summary: 'Talk to the HappyCake assistant; returns reply text + new thread id',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['text'],
                  properties: {
                    text: { type: 'string' },
                    thread_id: { type: 'string', description: 'reuse to continue a conversation' },
                    sender_name: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'replies' } },
        },
      },
    },
  }
}
