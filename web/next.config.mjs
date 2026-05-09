/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  experimental: {
    typedRoutes: false,
  },
  async rewrites() {
    const backend = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000'
    return [
      { source: '/api/chat', destination: `${backend}/api/chat` },
      { source: '/api/products', destination: `${backend}/api/products` },
      { source: '/api/products/:id', destination: `${backend}/api/products/:id` },
      { source: '/api/orders/draft', destination: `${backend}/api/orders/draft` },
      { source: '/api/orders/:id', destination: `${backend}/api/orders/:id` },
      { source: '/api/admin/:path*', destination: `${backend}/api/admin/:path*` },
      { source: '/openapi.json', destination: `${backend}/openapi.json` },
    ]
  },
}

export default nextConfig
