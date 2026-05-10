// Stories & guides — short, useful posts that double as SEO/GEO content.
// Each post is plain MDX-shaped data (no MDX runtime — keeps the surface
// small) and renders through a single template at /blog/[slug]. Topic
// selection biased to questions customers actually ask Askhat at the
// counter ("how far ahead?", "what's safe for my niece's nut allergy?",
// "what do you bring to a Houston office for 30?").

import { ASSETS, BRAND } from './brand'

export interface BlogPost {
  slug: string
  title: string
  description: string
  hero_url: string
  published_at: string // ISO date
  read_minutes: number
  tags: string[]
  body: BlogBlock[]
}

export type BlogBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'callout'; title: string; text: string }
  | { type: 'quote'; text: string; cite?: string }

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'honey-cake-six-layers',
    title: 'Why honey cake has six layers (and why it tastes better the next day)',
    description:
      'A short history of honey cake — the Eastern-European medovik, the six-layer math, and why we let every cake rest overnight before it goes in the case.',
    hero_url: ASSETS.products[0],
    published_at: '2026-04-22',
    read_minutes: 4,
    tags: ['honey-cake', 'tradition', 'baking'],
    body: [
      {
        type: 'p',
        text: 'Walk into any home from Almaty to Warsaw and ask for the cake on the table. Half the time it\'s honey cake — six thin layers of golden biscuit, a soft sour-cream custard between every one, walnuts on top. We make ours the way Askhat\'s grandmother made hers: by hand, in batches small enough that every cake gets the same attention.',
      },
      { type: 'h2', text: 'The six-layer rule' },
      {
        type: 'p',
        text: 'You can do four. You can do eight. But six is the sweet spot — enough that the custard has somewhere to live, not so many that the cake forgets it\'s a cake. The biscuit is rolled thin, baked dry, and stacked while the custard is still warm so it sinks in.',
      },
      { type: 'h3', text: 'Why honey, not sugar' },
      {
        type: 'p',
        text: 'Honey gives the layers their gold. It also keeps the cake moist for days — which matters because, traditionally, honey cake is meant to wait. We bake it in the morning, layer it by lunch, and let it rest in the cold case overnight. By the next afternoon every biscuit has softened just enough.',
      },
      {
        type: 'callout',
        title: 'Plan ahead for the best slice',
        text: 'Picking up a whole cake? Order today, pick up tomorrow afternoon — the rest does most of the work.',
      },
      { type: 'h2', text: 'What we changed for Sugar Land' },
      {
        type: 'p',
        text: 'Texas summers are not Almaty winters. Our custard is a touch firmer, our walnut topping a touch lighter so it doesn\'t go bitter in the heat. The cake is the same cake. The kitchen is the same kitchen, just five thousand miles south-west of where it started.',
      },
      {
        type: 'quote',
        text: 'Every recipe in our kitchen came from family — written by hand, tested at the dinner table.',
        cite: 'Askhat, owner',
      },
    ],
  },
  {
    slug: 'custom-cake-planning-houston',
    title: 'How to plan a custom cake in Houston — what we need from you, and when',
    description:
      'A plain-English guide to ordering a custom cake from a Sugar Land bakery — flavors, fillings, dietary needs, lead times, and what we actually need on the order form.',
    hero_url: ASSETS.products[7],
    published_at: '2026-04-29',
    read_minutes: 5,
    tags: ['custom-cake', 'planning', 'birthday', 'wedding'],
    body: [
      {
        type: 'p',
        text: 'Custom cakes are 80% planning, 20% baking. The good news: most of the planning is decisions you\'ve already made — you know who it\'s for, you know roughly how many people, and you have a rough date. Here\'s what we need to turn that into a cake.',
      },
      { type: 'h2', text: 'Lead times — the honest version' },
      {
        type: 'ul',
        items: [
          '24 hours — standard custom cake. Single tier, written message, simple decoration. Serves 12–20.',
          '36 hours — vegan or gluten-free custom (we cross-test the recipe).',
          '48 hours — multi-tier (two tiers and up), photo print on edible paper, fondant figures.',
          '72 hours — wedding cakes, large gatherings (40+), structural work like a tower or tiered fountain.',
        ],
      },
      {
        type: 'callout',
        title: 'Asked us last-minute?',
        text: 'It happens. Message us on WhatsApp and we\'ll tell you what\'s possible — sometimes the answer is yes for tomorrow if the flavor is honey cake or cloud cake (those scale fast).',
      },
      { type: 'h2', text: 'What to send with the order' },
      {
        type: 'ul',
        items: [
          'Headcount — round up. A 12-serving cake feeds 12 generous slices, 16 small ones.',
          'Occasion — birthday, anniversary, baby shower, "just because". This shapes the message and decoration.',
          'Allergens to avoid — we handle eggs, dairy, gluten, and nuts in shared spaces. Tell us early if anyone\'s severe.',
          'Photo or sketch — even a phone snapshot of "something like this". Easier than describing.',
          'Pickup or delivery — pickup at our Promenade Way counter is free; delivery is around Sugar Land + Greater Houston only.',
        ],
      },
      { type: 'h2', text: 'How we price' },
      {
        type: 'p',
        text: 'Custom cakes start at $95 for a single-tier 12-serving cake with simple decoration. Photo prints add $15. Fondant figures, $25 each. Multi-tier work is quoted by the cake — it depends on internal structure as much as decoration. We give you the price before we bake. No surprises at pickup.',
      },
      { type: 'h3', text: 'Pickup, delivery, and the day-of' },
      {
        type: 'p',
        text: 'Most customers pick up. The cake travels best in the box we pack it in, on a flat car floor (not the seat), and out of direct sun. If you need delivery, we cover Sugar Land and Greater Houston (ZIPs starting 770–777); fee depends on distance and confirmed at order time.',
      },
    ],
  },
  {
    slug: 'allergen-aware-bakery-sugar-land',
    title: 'Allergen-aware ordering — what a small bakery can (and can\'t) promise',
    description:
      'Sugar Land bakery owners on cross-contamination, gluten-free baking in a shared kitchen, nut-free decoration, and how to ask for what you actually need.',
    hero_url: ASSETS.products[8],
    published_at: '2026-05-04',
    read_minutes: 4,
    tags: ['allergens', 'gluten-free', 'nuts', 'transparency'],
    body: [
      {
        type: 'p',
        text: 'We get this question every week, usually from a parent: "what can I order for someone with a serious allergy?" The answer is honest, not marketing — and it changes a little depending on the allergen. Here\'s what a small bakery can actually promise.',
      },
      { type: 'h2', text: 'The shared-kitchen reality' },
      {
        type: 'p',
        text: 'Our kitchen handles eggs, dairy, gluten, and tree nuts every day. The benches, ovens, and cooling racks are shared. We clean thoroughly between batches but we don\'t run a separate gluten-free room — and we won\'t pretend we do.',
      },
      {
        type: 'callout',
        title: 'Severe allergy?',
        text: 'Tell us when you order, not when you pick up. We\'ll explain exactly what we can do — and where we have to say no.',
      },
      { type: 'h2', text: 'What we do well' },
      {
        type: 'ul',
        items: [
          'No-nut decoration on cakes that are usually walnut-topped — easy, ask for it.',
          'Vegan-style cakes (no eggs, no dairy) on 36-hour notice — we have a separate recipe and bench discipline.',
          'Halal-friendly: we use only fish and plant gelatin. Pork-free kitchen by default.',
          'Sourcing transparency: we\'ll tell you exactly which ingredients we used, brand and all, if it matters.',
        ],
      },
      { type: 'h2', text: 'Where we say no' },
      {
        type: 'ul',
        items: [
          'Anaphylactic peanut allergy — we don\'t use peanuts, but we can\'t guarantee zero airborne traces in a Sugar Land kitchen that handles tree nuts.',
          'Celiac-grade gluten-free — we offer a low-gluten cake on 36-hour notice but can\'t legally label it celiac-safe.',
          'Last-minute substitutions when the cake is already in the oven.',
        ],
      },
      { type: 'h3', text: 'How to ask' },
      {
        type: 'p',
        text: 'On the order form, the "Notes for the kitchen" field reads us straight to the bench. Be specific: "no walnuts at all", "child has dairy intolerance, use vegan recipe". If the allergy is severe, message us on WhatsApp first — we\'ll talk it through before you place the order.',
      },
      {
        type: 'p',
        text: `${BRAND.closing}`,
      },
    ],
  },
  {
    slug: 'cake-gifting-houston',
    title: 'Cake as a gift, done right — what works and what doesn\'t',
    description:
      'A small-bakery guide to gifting cakes in Houston — when to send a whole cake vs an assortment box, what travels well, how far ahead to order, and the most-loved gift pairings we ship from Sugar Land.',
    hero_url: ASSETS.products[9],
    published_at: '2026-05-08',
    read_minutes: 4,
    tags: ['gifting', 'corporate', 'houston', 'planning'],
    body: [
      {
        type: 'p',
        text: 'Sending a cake as a gift looks simple — pick something pretty, add a card, get it across town. The execution is where it gets interesting. Cakes are not flowers: they have a temperature window, a texture window, and a "looks like the photo" window. Here\'s how we think about it after six years of doing this for Sugar Land and Houston.',
      },
      { type: 'h2', text: 'When a whole cake wins' },
      {
        type: 'p',
        text: 'A whole cake is the right gift when there\'s a moment to cut into it — birthdays, retirements, a closing dinner. It\'s a centerpiece. People photograph it. It pulls the table together.',
      },
      {
        type: 'p',
        text: 'For a household: the honey cake or the cloud cake holds for two days in the fridge after you cut it; that\'s the realistic shelf life of a gift cake.',
      },
      { type: 'h2', text: 'When the assortment box wins' },
      {
        type: 'p',
        text: 'For an office: don\'t send one cake. Send the dessert box. Twelve people don\'t want to share one slice each — they want a small piece of three different things while they read the card. The Office Dessert Box is built for exactly this. Slices, rolls, mini cakes, three hours notice.',
      },
      {
        type: 'callout',
        title: 'Office gift rule of thumb',
        text: 'Headcount of 6 or under → whole cake. Headcount of 8+ → assortment box. The middle is where your read of the room matters.',
      },
      { type: 'h2', text: 'What travels well — and what doesn\'t' },
      {
        type: 'ul',
        items: [
          'Honey cake — the rolls Royce of travel. Layers tighten in the cold; it actually improves over an hour in the box.',
          'Pistachio roll — short window. Eat day-of, ideally within 4 hours of pickup.',
          'Custom decorated cakes with delicate fondant work — pick up only or short-distance delivery; long car rides melt the design in summer.',
          'Truffle bites and chak-chak — bulletproof. Send these to anyone, anywhere in Houston.',
        ],
      },
      { type: 'h2', text: 'Lead times for gifting' },
      {
        type: 'ul',
        items: [
          'Same-day office boxes — 3 hours notice when we have stock. Call us, don\'t use the form, if it\'s tight.',
          'Whole cake gift with a name on it — book the day before. Same-day works, but the kitchen is happier with notice.',
          'Custom design (photo print, fondant, multi-tier) — 24h minimum, 48h for a wedding-style cake.',
          'Holidays (Mother\'s Day, Eid, week of Christmas) — book 4–7 days ahead. The kitchen sells out.',
        ],
      },
      { type: 'h3', text: 'Card and message' },
      {
        type: 'p',
        text: 'We hand-write a card if you give us the message in the order notes. Up to about 80 characters fits the standard card cleanly; longer messages we still do, just on a bigger card. Names go on the cake itself in chocolate writing — give us the spelling exactly as you want it (we\'ve learned the hard way about "Catharine" vs "Katherine").',
      },
      { type: 'h2', text: 'How to actually send one' },
      {
        type: 'p',
        text: 'Order via the site, choose delivery, paste the recipient\'s address. We deliver across Sugar Land + Greater Houston. The recipient gets a text from our number when we\'re close. If you want it to be a surprise, write "do not call ahead" in the notes — we\'ll knock instead.',
      },
      {
        type: 'quote',
        text: 'The best gift cake is the one that arrives at the right temperature with the right card. Everything else is decoration.',
        cite: 'Askhat',
      },
    ],
  },
  {
    slug: 'sugar-land-bakery-neighborhood-guide',
    title: 'A Sugar Land afternoon — Promenade Way, parking, and what to pair with a slice',
    description:
      'Where to find HappyCake in Sugar Land, where to park, what\'s nearby, and how to plan a walking afternoon around a slice of honey cake on Promenade Way.',
    hero_url: ASSETS.hero[0],
    published_at: '2026-05-09',
    read_minutes: 3,
    tags: ['sugar-land', 'neighborhood', 'visit'],
    body: [
      {
        type: 'p',
        text: 'We get asked weekly: "Where exactly are you?" The answer is more useful than just an address. Here\'s the orientation card we wish we could hand every first-time visitor.',
      },
      { type: 'h2', text: 'Finding us' },
      {
        type: 'p',
        text: '350 Promenade Way, Suite 500 — the Promenade shopping area in Sugar Land. From US-59, take the University Boulevard exit and head east; you\'ll see the Promenade signs before you reach Sweetwater. We\'re inside the open-air retail block, ground floor, with a small patio.',
      },
      {
        type: 'callout',
        title: 'Map link in your pocket',
        text: 'Tap the address on our home page → it opens straight in your map app with directions. No screenshots needed.',
      },
      { type: 'h2', text: 'Parking' },
      {
        type: 'p',
        text: 'Plenty of free parking in front of the shop and across the lot. Weekday afternoons it\'s wide open; Saturday afternoons get busy — try the spaces by the fountain or the back lot. No meters, no validation needed.',
      },
      { type: 'h2', text: 'A walkable afternoon' },
      {
        type: 'p',
        text: 'Promenade Way is built for the slow walk. Pick up a slice at our counter, grab the espresso to go, and make the loop:',
      },
      {
        type: 'ul',
        items: [
          'The fountain plaza — five minutes east, benches, shade, a good place to actually eat the slice.',
          'Sugar Land Town Square — ten minutes drive, more shops and restaurants if the afternoon stretches.',
          'Oyster Creek trail — for the after-cake walk; flat, paved, takes you along the water.',
          'Library on University Boulevard — for the people who want to read with their cake (we approve).',
        ],
      },
      { type: 'h2', text: 'Best slice pairings with our espresso' },
      {
        type: 'ul',
        items: [
          'Honey cake + double espresso — the classic. Sweetness of the cake levels the bitterness of the shot.',
          'Tiramisu + cortado — espresso meets espresso. A small mountain of caffeine; plan accordingly.',
          'Cloud cake + cappuccino — light on light. Best for an afternoon you\'re dragging a little.',
          'Pistachio roll + Americano — the combination Askhat\'s wife orders at the end of every shift.',
        ],
      },
      { type: 'h3', text: 'When to come' },
      {
        type: 'p',
        text: 'Weekday mornings are our quietest stretch — Tuesday or Wednesday around 11am if you want a quiet table. Saturdays are hectic but festive; Sunday afternoons are a sweet spot if you want the case still full and the seats not all taken. Mondays we\'re closed so the kitchen rests.',
      },
      {
        type: 'p',
        text: `${BRAND.closing}`,
      },
    ],
  },
]

export function findBlogPost(slug: string): BlogPost | null {
  return BLOG_POSTS.find((p) => p.slug === slug) ?? null
}
