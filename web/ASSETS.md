# Image hosting

## Where Next.js serves images from

`web/public/**` is served at `/**` with no extra config. Drop a file at
`web/public/assets/hero/foo.webp` and it's reachable at `/assets/hero/foo.webp`.

That's it for local + the standalone build. **No image plugin, no CDN client,
no S3 SDK needed.** Next handles content-type, caching headers, and HTTP/2
push out of the box.

## Where to drop the binaries

Match the paths declared in [`src/lib/brand.ts`](src/lib/brand.ts) → `ASSETS`:

```
web/public/
├── assets/
│   ├── logo/
│   │   ├── happy-cake-logo-256.png
│   │   ├── happy-cake-logo-512.png
│   │   └── happy-cake-logo-1024.png
│   ├── hero/
│   │   ├── happy-cake-hero-01.webp
│   │   ├── happy-cake-hero-02.webp
│   │   ├── happy-cake-hero-03.webp
│   │   └── happy-cake-hero-04.webp
│   ├── products/
│   │   ├── happy-cake-product-01.webp
│   │   ├── ...
│   │   └── happy-cake-product-10.webp
│   ├── social/
│   │   ├── happy-cake-social-01.webp ... 08.webp
│   └── team/
│       └── owner-askhat.jpg
```

Until the binaries arrive, components fall back to brand-pattern placeholders
(`HeroImage`, `CakePhoto`, `Wordmark`) — never a broken-image rectangle.

## Favicon

Next.js App Router auto-serves these files when present in `app/`:

| File | Served at | Linked as |
|---|---|---|
| [src/app/favicon.ico](src/app/favicon.ico) | `/favicon.ico` | `<link rel="icon">` |
| [src/app/icon.svg](src/app/icon.svg) | `/icon.svg` | `<link rel="icon" type="image/svg+xml">` |
| `src/app/apple-icon.png` *(drop a file to enable)* | `/apple-icon.png` | `<link rel="apple-touch-icon">` |

To replace the favicon: drop a new `favicon.ico` in `app/` and rebuild.
For sharper Retina favicons, add a 180×180 `apple-icon.png` next to it.

## Production builds

The standalone build needs `public/` copied into the deploy artifact. Already
in the deploy recipe but worth highlighting:

```bash
bun run build
cp -r .next/static .next/standalone/.next/
cp -r public        .next/standalone/         # ← serves images
bun .next/standalone/server.js
```

## When to switch to DigitalOcean Spaces (CDN)

Stay on `public/` until any of:
- Asset count grows past ~50 files
- You want to update images without redeploying
- App-Platform CPU on `next/image` optimizer becomes an issue

Migration is **one config block + one constant**:

```js
// next.config.mjs
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'happycake.nyc3.cdn.digitaloceanspaces.com' },
    ],
  },
}
```

```ts
// src/lib/brand.ts — switch the ASSETS const
const CDN = 'https://happycake.nyc3.cdn.digitaloceanspaces.com'
export const ASSETS = {
  logo: { px256: `${CDN}/logo/happy-cake-logo-256.png`, ... },
  hero: [`${CDN}/hero/happy-cake-hero-01.webp`, ...],
  // ...
}
```

`next/image` handles the remote URL — same component API, just longer paths.
The `web/public/assets/` folder can stay as a fallback or be deleted entirely.

## Don't serve images from the backend

Don't proxy images through the Hono backend (`src/server.ts`). Two reasons:
- Extra hop, no caching benefit, eats backend CPU on static bytes
- Defeats `next/image`'s optimizer (which expects to fetch from `public/` or
  a configured remote)

Static images are a Next.js / CDN concern, not a backend one.
