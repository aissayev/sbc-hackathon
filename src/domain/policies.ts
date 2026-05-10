// HappyCake customer-facing policies. Single source of truth for any
// 'do you...?' / 'what time...?' / 'how do I...?' question the agent fields.
//
// Source map for each section:
//   fulfillment.pickup     — BRANDBOOK §3 (Sugar Land branch, neighbourhood place)
//   fulfillment.delivery   — BRANDBOOK §3 ('within ten miles or work nearby')
//   fulfillment.shipping   — BRANDBOOK §1 (neighbourhood place, not catalog) — 'we don't ship'
//   allergens              — BRANDBOOK §7 hard rule + brief (shared kitchen warning)
//   halal_friendly         — web/src/app/policies/page.tsx + web/src/lib/{dietary,widget}.ts
//                            (live-site source of truth; SKU list authored at site
//                            scaffolding time, not formally certified)
//   contact                — BRANDBOOK §3 visual identity (IG handle, Sugar Land)
//   hours                  — PLACEHOLDER — confirm with owner before launch
//   cancellation           — PLACEHOLDER — confirm with owner before launch
//   payment                — PLACEHOLDER — confirm with owner before launch
//
// What's NOT here (and why):
//   - lead_times / capacity → SANDBOX (kitchen_get_menu_constraints +
//     kitchen_get_capacity). Live values, per-SKU. Don't duplicate; the agent
//     calls those tools directly.
//   - prices → SANDBOX (square_list_catalog). Same reason.
//
// Exposed to the agent via mcp__local__get_policies (see local-server.ts).

export interface Policies {
  fulfillment: {
    pickup: { available: boolean; free: boolean; address: string }
    local_delivery: { available: boolean; area: string; fee_note: string }
    shipping: { available: boolean; note: string }
  }
  payment: {
    methods: string[]
    when: string
    _confidence?: string
  }
  allergens: {
    shared_kitchen_warning: string
    critical_allergy_protocol: string
    listed_per_product: boolean
  }
  halal_friendly: {
    statement: string
    always_halal_friendly_skus: string[]
    formally_certified: boolean
    confirm_at_order: string
  }
  cancellation: {
    free_until_hours_before: number
    late_cancel_charge_pct: number
    note: string
    _confidence?: string
  }
  hours: {
    note: string
    pickup_window: string
    _confidence?: string
  }
  contact: {
    whatsapp: string | null
    instagram_handle: string
    address: string
  }
}

export function getPolicies(): Policies {
  return {
    fulfillment: {
      pickup: {
        available: true,
        free: true,
        address: 'Sugar Land, TX (exact address shared at confirmation)',
      },
      local_delivery: {
        available: true,
        area: 'Sugar Land + Houston metro',
        fee_note: 'Fee depends on distance; confirmed at order time.',
      },
      shipping: {
        available: false,
        note: "We don't ship cakes \u2014 they're not the same after a day in transit.",
      },
    },
    payment: {
      methods: ['card', 'cash_at_pickup', 'zelle'],
      when: 'card via Square at confirmation; cash and zelle at pickup',
      _confidence: 'placeholder \u2014 confirm with owner before quoting as fact',
    },
    allergens: {
      shared_kitchen_warning:
        'Our kitchen handles eggs, dairy, gluten, and tree nuts in shared spaces. Every cake we make has at least one of these.',
      critical_allergy_protocol:
        'For severe allergies, escalate \u2014 Askhat reviews each request personally before we accept the order.',
      listed_per_product: true,
    },
    halal_friendly: {
      statement:
        'Most of our cakes use no alcohol and no pork-derived ingredients.',
      always_halal_friendly_skus: ['honey', 'milk-maiden', 'pistachio-roll'],
      formally_certified: false,
      confirm_at_order:
        "Tell us when you order and we'll confirm what's safe. We're halal-friendly, not formally halal-certified.",
    },
    cancellation: {
      free_until_hours_before: 24,
      late_cancel_charge_pct: 100,
      note: "Cancel free up to 24 hours before. After that, the cake is already started \u2014 late cancellations are charged in full because we can't sell a baked cake to anyone else.",
      _confidence: 'placeholder \u2014 confirm with owner before quoting as fact',
    },
    hours: {
      note: 'Replies within minutes during open hours.',
      pickup_window: '10:00 \u2013 19:00 CT, daily',
      _confidence: 'placeholder \u2014 confirm with owner before quoting as fact',
    },
    contact: {
      whatsapp: null,
      instagram_handle: '@happycake.us',
      address: 'Sugar Land, TX',
    },
  }
}
