// Single layout for all server-rendered pages. HappyCake brand applied via
// Tailwind config injected inline (Play CDN — no build step). Color tokens and
// typography mirror the brand book at docs/sandbox/BRANDBOOK.md.

export const BRAND = {
  name: 'HappyCake',
  city: 'Sugar Land, TX',
  tagline: "It's just like homemade.",
  slogan: 'The original taste of happiness.',
  closing: 'Order on the site at happycake.us or send us a message on WhatsApp.',
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

export function layout(opts: {
  title: string
  description?: string
  body: string
  jsonLd?: object | object[]
}): string {
  const ld = opts.jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(opts.jsonLd)}</script>`
    : ''
  const desc = opts.description ?? `${BRAND.tagline} ${BRAND.slogan}`
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(opts.title)} — ${BRAND.name}</title>
<meta name="description" content="${escapeHtml(desc)}" />
<link rel="alternate" type="application/llms.txt" href="/llms.txt" />
<link rel="canonical" href="https://happycake.us${opts.title === 'Home' ? '' : ''}" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
<script src="https://cdn.tailwindcss.com"></script>
<script>
tailwind.config = {
  theme: {
    extend: {
      colors: {
        happy: {
          900: '#0E2A3C',
          700: '#1B4868',
          500: '#3B7BA8',
          200: '#BFD8E8',
        },
        cream: {
          50: '#FBF6E8',
          100: '#F4ECD3',
          200: '#E9DBB4',
        },
        coral: '#E08066',
        sage: '#6E9D74',
        ink: '#1A1816',
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'serif'],
        body: ['"Inter"', 'sans-serif'],
      },
    },
  },
}
</script>
${ld}
</head>
<body class="bg-cream-50 text-ink antialiased font-body">
<header class="border-b border-happy-700/20 bg-cream-50">
  <div class="max-w-5xl mx-auto px-4 py-5 flex items-center justify-between">
    <a href="/" class="font-display text-2xl text-happy-900 tracking-tight">HappyCake</a>
    <nav class="text-sm space-x-6 text-happy-900">
      <a href="/" class="hover:text-happy-500">Home</a>
      <a href="/menu" class="hover:text-happy-500">Menu</a>
      <a href="/policies" class="hover:text-happy-500">Policies</a>
      <a href="/chat" class="hover:text-happy-500">Chat</a>
    </nav>
  </div>
</header>
<main class="max-w-5xl mx-auto px-4 py-10">
${opts.body}
</main>
<footer class="border-t border-happy-700/20 mt-16 py-8 text-sm text-happy-900/80">
  <div class="max-w-5xl mx-auto px-4 grid sm:grid-cols-3 gap-6">
    <div>
      <div class="font-display text-lg text-happy-900">HappyCake</div>
      <div>${BRAND.city}</div>
      <div class="mt-2 italic">"${BRAND.tagline}"</div>
    </div>
    <div>
      <div class="font-medium text-happy-900">For everyone</div>
      <a href="/menu" class="block hover:text-happy-500">Menu</a>
      <a href="/policies" class="block hover:text-happy-500">Allergens &amp; policies</a>
      <a href="/chat" class="block hover:text-happy-500">Chat with us</a>
    </div>
    <div>
      <div class="font-medium text-happy-900">For AI agents</div>
      <a href="/llms.txt" class="block hover:text-happy-500">llms.txt</a>
      <a href="/openapi.json" class="block hover:text-happy-500">OpenAPI</a>
      <a href="/api/products" class="block hover:text-happy-500">/api/products</a>
    </div>
  </div>
  <div class="max-w-5xl mx-auto px-4 mt-6 text-xs text-happy-900/60">
    © ${new Date().getFullYear()} HappyCake · Sugar Land, TX · Hackathon entry — production deploy after May 10
  </div>
</footer>
</body>
</html>`
}
