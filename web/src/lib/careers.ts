// Shared between the public /careers page and the admin cockpit so the
// "what roles do we publish" list is in one place. Mirrors the role enum
// in src/domain/applications.ts.

export type CareersRole = 'counter' | 'baker' | 'driver' | 'other'

export interface CareersRoleSpec {
  slug: CareersRole
  title: string
  schedule: string
  body: string
}

export const CAREERS_ROLES: CareersRoleSpec[] = [
  {
    slug: 'counter',
    title: 'Counter & coffee',
    schedule: 'Part-time · weekends',
    body:
      "Greet guests, build orders, pull espresso, package boxes. You're the first face people see — set the tone.",
  },
  {
    slug: 'baker',
    title: 'Baker / decorator',
    schedule: 'Full-time · early mornings',
    body:
      "Bake the day's case from scratch. Honey-cake layers, sponges, frostings, decorations. Recipes are taught — neat hands matter.",
  },
  {
    slug: 'driver',
    title: 'Delivery driver',
    schedule: 'Part-time · flexible',
    body:
      'Drive custom-cake deliveries across the Greater Houston area. Clean record, careful with cargo, friendly at the door.',
  },
]

// Friendly label table for any of the four role slugs (including "other"),
// mirroring `APPLICATION_ROLE_LABEL` on the backend so the admin cockpit
// reads the same way.
export const CAREERS_ROLE_LABEL: Record<CareersRole, string> = {
  counter: 'Counter & coffee',
  baker: 'Baker / decorator',
  driver: 'Delivery driver',
  other: 'Other / open',
}
