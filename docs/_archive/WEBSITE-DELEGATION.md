# Website session brief — for the agent building `web/`

You're picking up the customer-facing website for **HappyCake US** (Sugar Land, TX), a real bakery whose owner is Askhat. This is a hackathon entry; submission deadline May 10 at 10:00 CT. Your work lives in a fresh Next.js project; the existing `src/` (Bun + Hono backend) is the production source for catalog, orders, and chat — you call its APIs.

**Read this entire file before writing any code. Then read the references at the bottom. Then ask one batch of clarifying questions and start.**

---

## What you're building

A Next.js 15 App Router website for HappyCake US that:

1. Sells cakes (catalog, product detail, ordering through chat-driven flow)
2. Hosts the on-site assistant (talks to our backend's `/api/chat`)
3. Is **agent-friendly** — Schema.org JSON-LD per product, OpenAPI spec, llms.txt, sitemap.xml, machine-readable everything
4. Doubles as a **Telegram Mini App** for the owner (admin views: pending approvals, today's orders, daily report) using the same Next.js codebase
5. Will eventually deploy to DigitalOcean Apps (or droplet) — not Vercel

This is an **e-commerce site**, not a brochure. Treat order intake as the primary funnel.

---

## Stack — confirmed

| Concern | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router, RSC)** | Best DX for fast iteration on cards/forms; great agent-friendly defaults (metadata API, structured data) |
| Runtime | **Bun** | Same as backend; no node_modules churn between projects |
| Styling | **Tailwind CSS** | Already in use across the team |
| Components | **shadcn/ui (default style, neutral base)** | Production-grade accessible primitives, no library lock-in |
| Icons | **lucide-react** | Default for shadcn |
| Forms | **react-hook-form + zod** | Type-safe with our backend schemas |
| Data fetching | **fetch + Server Components** | No SWR/React Query unless we have client-mutation pages |
| Auth (admin / Mini App) | **Telegram Login Widget + initData HMAC verify** | Owner is the only "admin"; Telegram is his login |
| State | **None client-side beyond useState** | Don't add Zustand/Redux — RSC + URL state is enough |

**Do not add:** Drizzle, Prisma, separate database. The backend at `../src/` owns all data. The website is a presentation/interaction layer.

---

## Where it lives

Create the website inside the existing repo at the path **`web/`**:

```
sbc-hackathon/
├── src/                  ← existing backend (Hono, agent runtime, MCP) — DO NOT TOUCH
├── data/                 ← existing seed data
├── docs/                 ← existing docs (READ THESE)
├── package.json          ← existing backend
├── tsconfig.json         ← existing backend
├── .gitignore            ← existing — APPEND web/node_modules etc.
└── web/                  ← YOU CREATE THIS
    ├── package.json      ← Next.js 15, React 19, shadcn deps
    ├── next.config.mjs
    ├── tailwind.config.ts
    ├── postcss.config.mjs
    ├── components.json   ← shadcn config
    ├── tsconfig.json
    └── src/
        ├── app/          ← App Router routes
        ├── components/
        ├── lib/
        └── styles/
```

Why same repo: single GitHub remote, single submission, easier code review, no cross-repo PR pain. Different `package.json` files means independent dependency trees — no conflicts with the backend.

The two stacks talk over HTTP. Local dev: backend on `:3000`, website on `:3001`, website reads `NEXT_PUBLIC_BACKEND_URL=http://localhost:3000`. In prod: same host or reverse-proxied.

---

## Sitemap — confirm before building

The proposed structure (await user confirmation; modify if they say so):

| Route | Purpose | Render |
|---|---|---|
| `/` | Hero, brand-led, three signposts (menu / chat / story), promo strip | RSC |
| `/menu` | Full catalog grid; filter chips for category + allergen-free options | RSC |
| `/menu/[slug]` | Product detail: photo, story, allergens, lead time, daily capacity, "Start an order" CTA → `/chat?product=<id>` | RSC + JSON-LD `Product` |
| `/order` | Direct order form (customer skips chat — fills product + qty + date + contact). On submit → POST to backend `/api/orders/draft` (TODO add to backend), then to `/order/confirm/<id>` | RSC + client form |
| `/order/confirm/[id]` | "Order received! Askhat will approve within an hour. Track here:" + status polling | RSC + client poll |
| `/chat` | On-site assistant. Embedded chat widget. Persists `thread_id` in `localStorage`. Same as today's stub but proper UX. | Client component, talks to `/api/chat` |
| `/policies` | Allergens, lead times, fulfillment, payment, cancellation. Long-form, brand-voiced. | RSC |
| `/about` | The HappyCake story (use brand book Section 1.1 — manifesto). | RSC |
| `/admin` | Owner login (Telegram Login Widget). Redirects to `/admin/today` if authed. | RSC |
| `/admin/today` | Daily report: orders, revenue, escalations, pending approvals. Same data as the `/today` Telegram command. | RSC, polls `/api/admin/today` |
| `/admin/orders` | Order queue with filters (status, channel, date). Inline approve/reject buttons. | RSC + client mutations |
| `/admin/orders/[id]` | Order detail: thread transcript, items, status timeline, kitchen ticket link, raw events. | RSC |
| `/admin/escalations` | Open escalations queue with severity, context, "mark resolved" action. | RSC + client mutations |

**Telegram Mini App entry**: any `/admin/*` route works. Configure BotFather with menu button → `https://<our-domain>/admin/today`. The page detects `window.Telegram.WebApp` and renders Mini App affordances (MainButton for primary actions, themed colors). Same codebase.

**Agent-discoverable surfaces** (already in backend, no work needed):
- `/llms.txt` — the agent surface map
- `/api/products` — JSON catalog
- `/api/products/:id` — product detail JSON
- `/openapi.json` — OpenAPI 3.1 spec
- `/sitemap.xml` — TODO: backend currently doesn't serve one. Generate from products list. Either backend serves it or Next.js does (Next 15 has built-in `app/sitemap.ts`).

---

## Brand voice — non-negotiable

Read [docs/sandbox/BRANDBOOK.md](./sandbox/BRANDBOOK.md) **front to back** before writing any copy. Hard rules:

- Brand name: **HappyCake** (one word, two capitals — never "Happy Cake", never "happycake", never "HC")
- Slogan: *"The original taste of happiness."*
- Tagline: *"It's just like homemade."*
- Closing on order pages: *"Order on the site at happycake.us or send us a message on WhatsApp."*
- Cake names in body copy: cake "Honey", cake "Pistachio Roll" (in quotes, after the word "cake")
- Short sentences. Plain words. No hype. Max 1 emoji. Often zero.
- **Color palette** (cream + Happy Blue):
  - `happy-900` `#0E2A3C` — page chrome, footer, dark hero
  - `happy-700` `#1B4868` — logo blue, primary buttons
  - `happy-500` `#3B7BA8` — links, accents
  - `happy-200` `#BFD8E8` — surfaces, badges
  - `cream-50` `#FBF6E8` — page background
  - `cream-100` `#F4ECD3` — card surfaces
  - `cream-200` `#E9DBB4` — highlight, dot patterns
  - Accents (sparingly): `coral #E08066`, `sage #6E9D74`
- **Typography**: Cormorant Garamond (display), Inter (body). Already loaded via Google Fonts in the existing layout.
- **Voice examples** in brand book section 2 — copy 5–10 examples for reference; never invent.

---

## Reference repos (read but don't copy)

1. **Kilo portal** at [/Users/adilet/workspace/ai-saas-training/cohorts/kilo-eng/portal](file:///Users/adilet/workspace/ai-saas-training/cohorts/kilo-eng/portal)
   - Same stack we're using: Next.js 15 + React 19 + shadcn + Tailwind + Bun
   - Look at: `src/app/(app)/dashboard/`, `src/app/(app)/admin/`, `src/components/admin/`, `src/components/brand/`, `src/components/ui/` (shadcn), `components.json`, `tailwind.config.ts`, `next.config.mjs`
   - Don't copy paste. Reference patterns: route groups, server actions, shadcn integration, admin layout shape.

2. **Existing backend** at [../src/](../src) (this repo)
   - Read: `src/web/pages.ts` (current server-rendered HTML — captures the brand you should match in Next.js)
   - Read: `src/routes/api.ts` and `src/server.ts` to know which JSON endpoints exist
   - Read: `src/domain/tools.ts` for product/order shapes (TypeScript types you can re-export)

3. **happycake.kz** (the Russian original)
   - It's a JS-rendered SPA; WebFetch can't crawl it cleanly
   - Use Firecrawl or Claude in Chrome MCP if you need actual content
   - **It is a draft reference only** — explicitly directed by the user to "drastically improve UX/UI"
   - We are targeting US market (English, Sugar Land context). Don't copy Russian copy.

4. **Brand book** at [./sandbox/BRANDBOOK.md](./sandbox/BRANDBOOK.md)
   - 26KB. Read it. The voice section especially — it is the system prompt for every piece of copy you write.

---

## Backend contract — what's already built

The Hono backend at `../src/` exposes these endpoints. Don't replicate them; consume them.

### Public, no auth

```
GET  /api/products                    → { products: Product[] }
GET  /api/products/:id                → Product | { error: 'not found' }
GET  /llms.txt                        → text/plain
GET  /openapi.json                    → OpenAPI 3.1 spec
POST /api/chat                        → { thread_id, replies: string[] }
       body: { thread_id?, text, sender_name? }
```

### What you need from the backend (NOT YET BUILT — request before relying)

These need to be added to `../src/routes/api.ts` for your `/order` and `/admin/*` pages. Coordinate with the backend agent (Adilet):

```
GET  /api/policies                    → { lead_time, fulfillment, allergens, ... }
POST /api/orders/draft                → creates a draft via the same code path as the agent
       body: { items, scheduled_at, customer_name, customer_phone, notes, channel: 'web' }
GET  /api/orders/:id                  → status + items (public — uses order id as the secret)

# Admin (gated by Telegram initData verification):
GET  /api/admin/today                 → daily report
GET  /api/admin/orders                → recent orders
POST /api/admin/orders/:id/approve    → triggers sandbox writes (square_create_order, kitchen_create_ticket)
POST /api/admin/orders/:id/reject     → with reason
GET  /api/admin/escalations           → open escalations
POST /api/admin/escalations/:id/resolve
```

These endpoints don't exist yet in the backend. Spec them in your delegation; Adilet will add them in parallel. Use TypeScript-shared types from `../src/domain/tools.ts` if you import via path alias.

### TypeScript types — share, don't duplicate

Don't redefine `Product`, `Order`, etc. Pull them from the backend:

```ts
// web/tsconfig.json — add a path alias
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@backend/*": ["../src/*"]
    }
  }
}

// in any web file:
import type { Product } from '@backend/domain/tools'
```

This works because both stacks use Bun and TypeScript compiles cross-package types.

---

## Telegram Mini App — implementation notes

Read [docs/TELEGRAM-AND-MINI-APP.md](./TELEGRAM-AND-MINI-APP.md) for the full primer. Tactical for your build:

1. Add Telegram Web App SDK to `app/admin/layout.tsx`:
   ```html
   <script src="https://telegram.org/js/telegram-web-app.js" async />
   ```
2. Detect Mini App context client-side:
   ```ts
   'use client'
   import { useEffect } from 'react'
   export function MiniAppBridge() {
     useEffect(() => {
       const tg = (window as any).Telegram?.WebApp
       if (!tg) return
       tg.ready()
       tg.expand()
       // theme adaptation
       document.documentElement.style.setProperty('--tg-theme', tg.themeParams.bg_color ?? '')
     }, [])
     return null
   }
   ```
3. **Verify `initData` server-side** for every admin API call:
   - User passes the raw `initData` string in an `X-Telegram-Init-Data` header.
   - Backend (Adilet) verifies HMAC-SHA256(secret = HMAC-SHA256(bot_token, "WebAppData"), data) == hash.
   - Reject if hash mismatch or auth_date older than 24h.
4. **Same routes serve both modes**: `/admin/today` works in a regular browser (Telegram Login Widget) AND in a Mini App (initData verified). One codebase, two entry points.

---

## What NOT to build

- ❌ A new agent runtime. The backend owns this. The website doesn't spawn `claude -p`. It just hits `/api/chat`.
- ❌ A new database / ORM. SQLite at `../src/db/` is the only DB.
- ❌ Server-side state beyond Next.js cache. No Redis, no sessions store.
- ❌ Customer auth. Customers are anonymous; identified by `thread_id` in localStorage.
- ❌ Email. Per brief, owner UI is Telegram only. No notification emails to customer either — replies happen in the channel they came from.
- ❌ Payment integration. The brief simulates payments via sandbox `square_create_order`; we don't take real cards. Just say "card via Square at confirmation."

---

## Quality bar

- TypeScript strict mode. No `any` outside very narrow seams.
- Every page rendered server-side where possible. Client components only when they need state/interactivity.
- Accessibility: keyboard navigable, ARIA labels on icon buttons, focus rings visible.
- Mobile-first. The customer journey is on phones. The Mini App is on phones. Don't desktop-first this.
- Lighthouse: aim for 90+ Performance, 100 Accessibility, 95+ SEO.
- No bundle bloat. Don't add radix-popover if a `<details>` works.
- All catalog data flows through `/api/products` — never inline a product list in code.

---

## Time budget — what good looks like in 8–10 hours

| Hour | Deliverable |
|---|---|
| 0–1 | Scaffold Next.js + Tailwind + shadcn; read brand book; verify backend reachable |
| 1–3 | Layout + home + menu + product detail. JSON-LD wired. Brand colors + fonts in. |
| 3–4 | Chat page rebuilt as proper React component, talks to `/api/chat` |
| 4–6 | Direct order form (`/order`) + confirmation page. Coordinate with backend for `/api/orders/draft`. |
| 6–7 | Policies + about pages |
| 7–8 | Admin shell (`/admin/login`, `/admin/today`, `/admin/orders`) — empty data is fine; just the layout works |
| 8–9 | Mini App detection + theming on `/admin/*` |
| 9–10 | Polish, mobile fixes, deploy to DigitalOcean Apps (or run on a tunnel for the demo) |

If you're past 10h with admin still empty, ship the customer side and skip admin. The customer side is judged by 3 rubric lines (Functional Tester, Agent-Friendliness, On-Site Assistant — 50 points). Admin is judged by Operator Simulator only (15 points), and the Telegram bot already covers most of it.

---

## How you ship updates while Adilet works on the backend

1. Trunk-based on `main`. Push to `main` directly.
2. Before each push: `bun run typecheck && bun run build` from `web/`.
3. **Don't touch anything outside `web/`.** If you need a backend route, write the spec in your commit message and ping Adilet — he'll land it in a separate commit.
4. **Don't commit `web/.env.local`, `web/.next/`, `web/node_modules/`** — extend root `.gitignore` if needed.

---

## First-message checklist for the user (Adilet)

Send this back to him in your first message, then start:

1. Confirm sitemap (above) — green-light or amend?
2. Confirm `/admin` is ONLY for owner Mini App (no customer accounts), or do customers also need accounts?
3. Where to deploy: DigitalOcean Apps with Next.js standalone build, or droplet with PM2? (Both work; first is faster.)
4. Domain: are we registering `happycake.us` for real, or running on a tunnel for the demo?
5. **Confirm: am I using `web/` subfolder in this repo, or a sibling repo?** (Recommend subfolder.)

---

## Reference docs already in this repo

- [README.md](../README.md) — project overview
- [ARCHITECTURE.md](../ARCHITECTURE.md) — backend agent runtime + MCP
- [AGENTS.md](../AGENTS.md) — entry point for AI sessions
- [docs/MCP-PRIMER.md](./MCP-PRIMER.md) — what the sandbox MCP can do
- [docs/DATA-MODEL.md](./DATA-MODEL.md) — SQLite tables and source-of-truth rule
- [docs/HOW-INVOKE-WORKS.md](./HOW-INVOKE-WORKS.md) — claude -p subprocess walkthrough
- [docs/TELEGRAM-AND-MINI-APP.md](./TELEGRAM-AND-MINI-APP.md) — Mini App implementation
- [docs/AGENT-SDK-RETROFIT.md](./AGENT-SDK-RETROFIT.md) — post-hackathon migration path
- [docs/sandbox/BRANDBOOK.md](./sandbox/BRANDBOOK.md) — **read this first**
- [docs/sandbox/SNAPSHOT.md](./sandbox/SNAPSHOT.md) — sandbox catalog data
- [docs/HACKATHON_BRIEF.md](./HACKATHON_BRIEF.md) — verbatim brief

Don't reinvent anything. If a doc covers it, use it.
