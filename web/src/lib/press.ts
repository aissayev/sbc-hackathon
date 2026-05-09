// Real press appearances + YouTube videos. Order is "newest first" — the
// home page also reads from here for the "We're in the media" band, so the
// row order determines what gets featured.

export interface Appearance {
  type: 'youtube' | 'press' | 'podcast'
  title: string
  outlet: string
  date: string // ISO
  description: string
  url?: string
  // YouTube video id when type === 'youtube'. Used to embed via
  // youtube-nocookie.com so we don't drop a third-party cookie until the
  // user clicks play.
  youtube_id?: string
}

export const APPEARANCES: Appearance[] = [
  {
    type: 'press',
    title: 'Kazakhstan-based Happy Cake offers sweets, coffee at 1st US location',
    outlet: 'Community Impact · Sugar Land / Missouri City',
    date: '2024-09-30',
    description:
      'Community Impact covers our Sugar Land opening — first US location of a Kazakhstan-born bakery, the family team behind the counter, and what we serve.',
    url: 'https://communityimpact.com/houston/sugar-land-missouri-city/business/2024/09/30/kazakhstan-based-happy-cake-offers-sweets-coffee-at-1st-us-location/',
  },
  {
    type: 'youtube',
    title: 'Inside Happy Cake — a tour of the bakery',
    outlet: 'YouTube',
    date: '2024-10-15',
    description:
      'Walk through our Sugar Land counter — the case, the espresso bar, and the kitchen behind the wall. Filmed during a regular open day.',
    url: 'https://www.youtube.com/watch?v=OZpah5Yq5lE',
    youtube_id: 'OZpah5Yq5lE',
  },
  {
    type: 'youtube',
    title: 'How we bake the signature honey cake',
    outlet: 'YouTube',
    date: '2024-11-08',
    description:
      'Askhat walks through one bake of the honey cake — the six layers, the custard, the overnight rest. The long version of "why six layers".',
    url: 'https://www.youtube.com/watch?v=OmhB2Kg-K9s',
    youtube_id: 'OmhB2Kg-K9s',
  },
]
