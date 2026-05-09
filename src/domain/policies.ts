// Customer-facing policies. Static today; could be sourced from sandbox if a
// `policies_get` tool ever lands. Schema is JSON-friendly so agents and the
// website can consume the same shape.

export interface Policies {
  lead_times: {
    default_minutes: number
    custom_orders_min_hours: number
    catering_min_hours: number
    weddings_min_hours: number
    note: string
  }
  fulfillment: {
    pickup: { available: boolean; free: boolean; address: string }
    local_delivery: { available: boolean; area: string; fee_note: string }
    shipping: { available: boolean; note: string }
  }
  payment: {
    methods: string[]
    when: string
  }
  allergens: {
    shared_kitchen_warning: string
    critical_allergy_protocol: string
    listed_per_product: boolean
  }
  cancellation: {
    free_until_hours_before: number
    late_cancel_charge_pct: number
    note: string
  }
  hours: {
    note: string
    pickup_window: string
  }
  contact: {
    whatsapp: string | null
    instagram_handle: string
    address: string
  }
}

export function getPolicies(): Policies {
  return {
    lead_times: {
      default_minutes: 45,
      custom_orders_min_hours: 24,
      catering_min_hours: 3,
      weddings_min_hours: 168,
      note: "Lead times are per product. Slices are usually ready from the case; whole cakes need an hour for cutting; custom designs need 24 hours. Check `kitchen_get_capacity` for the live picture before promising a date.",
    },
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
        note: "We don't ship cakes — they're not the same after a day in transit.",
      },
    },
    payment: {
      methods: ['card', 'cash_at_pickup', 'zelle'],
      when: 'card via Square at confirmation; cash and zelle at pickup',
    },
    allergens: {
      shared_kitchen_warning:
        'Our kitchen handles eggs, dairy, gluten, and tree nuts in shared spaces. Every cake we make has at least one of these.',
      critical_allergy_protocol:
        'For severe allergies, escalate — Askhat reviews each request personally before we accept the order.',
      listed_per_product: true,
    },
    cancellation: {
      free_until_hours_before: 24,
      late_cancel_charge_pct: 100,
      note: "Cancel free up to 24 hours before. After that, the cake is already started — late cancellations are charged in full because we can't sell a baked cake to anyone else.",
    },
    hours: {
      note: 'Replies within minutes during open hours.',
      pickup_window: '10:00 – 19:00 CT, daily',
    },
    contact: {
      whatsapp: null,
      instagram_handle: '@happycake.us',
      address: 'Sugar Land, TX',
    },
  }
}
