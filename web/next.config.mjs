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
      { source: '/api/chat', destination: `${backend}/api/chat` },
      { source: '/api/products', destination: `${backend}/api/products` },
      { source: '/api/products/:id', destination: `${backend}/api/products/:id` },
      { source: '/api/orders/draft', destination: `${backend}/api/orders/draft` },
      { source: '/api/orders/:id', destination: `${backend}/api/orders/:id` },
      { source: '/api/leads/:source', destination: `${backend}/api/leads/:source` },
      { source: '/api/uploads', destination: `${backend}/api/uploads` },
      { source: '/api/admin/:path*', destination: `${backend}/api/admin/:path*` },
      { source: '/openapi.json', destination: `${backend}/openapi.json` },
    ]
  },
}

export default nextConfig
