# Component layout

A small, opinionated structure. Five buckets, clear purpose for each.

```
web/src/components/
├── ui/             ← Primitives (button, input, badge, label, card, textarea)
├── layout/         ← Site chrome + standard page primitives
├── brand/          ← Brand identity (wordmark, eyebrow, hero-image, hours)
├── sections/       ← Page-level composed sections (extracted from app/* pages)
└── <feature>/      ← Feature folders: order, chat, business, help-widget, admin, product, ...
```

## When you reach for what

| Need | Use |
|---|---|
| A button, input, badge | `@/components/ui/*` |
| Standard 1240px container | `@/components/layout/container` |
| A page section with the standard rhythm | `@/components/layout/section` |
| The eyebrow + h1 + lead at the top of a content page | `@/components/layout/page-hero` |
| The dark cocoa "Today's bake" closing band | `@/components/layout/cta-band` |
| The "Happy Cake" wordmark / cupcake mark | `@/components/brand/wordmark` |
| A hero-grade image with brand-pattern fallback | `@/components/brand/hero-image` |
| Hours table or "open now" status | `@/components/brand/hours` |
| Multi-step forms (custom cake, B2B inquiry) | feature folder under `@/components/<feature>/*` |

## Layout primitives — quick reference

```tsx
import { Container } from '@/components/layout/container'
import { Section } from '@/components/layout/section'
import { PageHero } from '@/components/layout/page-hero'
import { CtaBand } from '@/components/layout/cta-band'

// Top of a content page (/menu, /dietary, /business, /about, /chat, /order)
<PageHero
  eyebrow="Today's menu"
  title={<>Something for <span className="text-sky">every sweet tooth</span></>}
  intro="Slices ready from the case, whole cakes…"
  actions={<>
    <Button asChild><Link href="/order">Order a cake</Link></Button>
  </>}
  visual={<HeroImage src={ASSETS.hero[0]} alt="A cake" className="aspect-[4/5]" />}
/>

// Standard content section
<Section eyebrow="Why guests come back" title="Made with heart" centered>
  <div className="grid sm:grid-cols-4 gap-5">{/* ... */}</div>
</Section>

// Tone variants
<Section tone="cream">      ← cream-100 background, edge-to-edge
<Section tone="cocoa">      ← dark cocoa-900 background, cream text
<Section tone="sky">        ← faint sky tint

// Closing band — every page that ends with a CTA
<CtaBand eyebrow="Today's bake is out" title="Come in for a slice — or order by Saturday.">
  <Button asChild variant="sky"><Link href="/order">Start an order</Link></Button>
</CtaBand>
```

## Migration plan

These primitives are **net new** — they don't break any existing pages. Pages adopt them incrementally as we touch them. Long-term goal:

- [ ] `/menu` use PageHero + CtaBand
- [ ] `/dietary` use PageHero + CtaBand
- [ ] `/business` use PageHero + CtaBand
- [ ] `/order` use PageHero + CtaBand
- [ ] `/about` use PageHero + Section + CtaBand
- [ ] `/policies` use PageHero
- [ ] `/chat` use PageHero
- [ ] `/order/custom` use PageHero
- [ ] `/business/inquire` use PageHero
- [ ] `/` (home) — extract Hero, Pillars, Manifesto, VisitSection, BusinessBand, ClosingCta into `sections/home/*`

Once a page is migrated, delete the duplicated inline JSX. Net effect: ~600 lines of duplication removed across the eight content pages.

## Conventions

- **Server Components by default.** Add `'use client'` only when a component needs `useState`, `useEffect`, event handlers, or context.
- **Brand primitives are server-render-friendly.** `Wordmark`, `Eyebrow`, `HeroImage` (note: HeroImage is `'use client'` because it tracks load state).
- **Layout primitives are server-render-friendly.** Container, Section, PageHero, CtaBand are all RSC.
- **One component per file.** Co-locate types and small helpers in the same file; extract to a `lib/` module if used by 2+ components.
- **No barrel `index.ts` files.** Direct imports are clearer in the diff and stack traces.

## File-size cap

ESLint rule (planned): `max-lines: 600`. Largest file today is `order-form.tsx` at 350 lines. None over the cap.
