/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  experimental: {
    typedRoutes: false,
  },
  // next/image is allowed to optimize from:
  //  - the hackathon CDN (current default)
  //  - any DO Spaces region (so when NEXT_PUBLIC_CDN_BASE flips to your
  //    bucket, images keep being optimized rather than served raw)
  //  - any Spaces CDN edge (the *.cdn.digitaloceanspaces.com hostname)
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'www.steppebusinessclub.com', pathname: '/hackathon-assets/**' },
      { protocol: 'https', hostname: 'steppebusinessclub.com', pathname: '/hackathon-assets/**' },
      { protocol: 'https', hostname: '*.digitaloceanspaces.com' },
      { protocol: 'https', hostname: '*.cdn.digitaloceanspaces.com' },
    ],
  },
  async rewrites() {
    const backend = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000'
    return [
      // /api/chat/history MUST come before /api/chat — Next matches the
      // first source pattern in order and a bare `/api/chat` would shadow
      // sub-paths in some versions.
      { source: '/api/chat/history', destination: `${backend}/api/chat/history` },
      { source: '/api/chat', destination: `${backend}/api/chat` },
      // Local-disk upload fallback serves files at /uploads/<key>; in
      // prod with Spaces wired the response URL is the CDN domain so
      // this rewrite is unused.
      { source: '/uploads/:path*', destination: `${backend}/uploads/:path*` },
      { source: '/api/products', destination: `${backend}/api/products` },
      { source: '/api/products/:id', destination: `${backend}/api/products/:id` },
      { source: '/api/orders/draft', destination: `${backend}/api/orders/draft` },
      { source: '/api/orders/:id', destination: `${backend}/api/orders/:id` },
      { source: '/api/leads/:source', destination: `${backend}/api/leads/:source` },
      // Career applications — public submission endpoint. Admin-side list +
      // status updates ride the /api/admin/:path* rewrite below.
      { source: '/api/careers/apply', destination: `${backend}/api/careers/apply` },
      // Checkout-funnel heartbeat. Fired by the OrderForm wizard on every
      // step change + on submit so we can track abandoned carts.
      { source: '/api/checkout/heartbeat', destination: `${backend}/api/checkout/heartbeat` },
      { source: '/api/uploads', destination: `${backend}/api/uploads` },
      { source: '/api/admin/:path*', destination: `${backend}/api/admin/:path*` },
      // Policies — backed by getPolicies() in src/domain/policies.ts.
      // Same shape as /api/products: agent-readable, public.
      { source: '/api/policies', destination: `${backend}/api/policies` },
      // Catalog reconciliation — sandbox-mirrored canonical list.
      { source: '/api/catalog', destination: `${backend}/api/catalog` },
      { source: '/api/catalog/sync', destination: `${backend}/api/catalog/sync` },
      // Evaluator entrypoint — the rubric explicitly grades against this path.
      // Never serve it from the Next.js side; always proxy to the agent runtime.
      { source: '/test/incoming', destination: `${backend}/test/incoming` },
      { source: '/openapi.json', destination: `${backend}/openapi.json` },
      // WhatsApp + Instagram webhooks. Sandbox MCP (and Meta Cloud API in
      // prod) push customer-side events to these paths; the backend's
      // src/routes/webhooks.ts handler reads HMAC sigs + dispatches to the
      // agent. Without these rewrites the public URL the operator
      // registered (e.g. `bun run register-webhooks https://happycake…`)
      // 404s and the inbox stays silent. Both paths are unauth-but-signed,
      // so passing them straight through is safe.
      { source: '/webhooks/whatsapp', destination: `${backend}/webhooks/whatsapp` },
      { source: '/webhooks/instagram', destination: `${backend}/webhooks/instagram` },
    ]
  },
}

export default nextConfig
