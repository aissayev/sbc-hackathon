// Delivery zone — Happy Cake delivers around Sugar Land and Greater Houston.
// We validate ZIP against Houston-metro prefixes (770-777) so the form rejects
// orders to other cities/states up front rather than at the kitchen.
//
// Source: USPS ZIP-3 prefix table for the Greater Houston / Fort Bend /
// Brazoria / Galveston / Conroe corridor. Anything outside this range goes
// through chat / WhatsApp so the owner can quote a custom delivery price.

export const HOUSTON_ZIP_PREFIXES = ['770', '771', '772', '773', '774', '775', '776', '777'] as const

// A short curated list of cities we cover end-to-end. Used for the delivery
// form's helper text and the address autocomplete fallback when no Places
// API is configured. Order is "closest to the bakery first".
export const DELIVERY_CITIES = [
  'Sugar Land',
  'Stafford',
  'Missouri City',
  'Richmond',
  'Bellaire',
  'West University Place',
  'Houston',
  'Katy',
  'Pearland',
] as const

export interface DeliveryAddress {
  street: string
  city: string
  state: 'TX'
  zip: string
}

export interface DeliveryAddressValidation {
  ok: boolean
  reason?: string
}

export function validateZipForDelivery(zip: string): DeliveryAddressValidation {
  const digits = zip.replace(/\D/g, '').slice(0, 5)
  if (digits.length !== 5) {
    return { ok: false, reason: 'ZIP must be 5 digits.' }
  }
  if (!HOUSTON_ZIP_PREFIXES.some((p) => digits.startsWith(p))) {
    return {
      ok: false,
      reason: 'We deliver around Sugar Land and Greater Houston. Try pickup, or message us for a custom delivery quote.',
    }
  }
  return { ok: true }
}

export function validateDeliveryAddress(addr: Partial<DeliveryAddress>): DeliveryAddressValidation {
  if (!addr.street || addr.street.trim().length < 4) {
    return { ok: false, reason: 'Street address required.' }
  }
  if (!addr.city || addr.city.trim().length < 2) {
    return { ok: false, reason: 'City required.' }
  }
  if (addr.state && addr.state !== 'TX') {
    return { ok: false, reason: 'We only deliver in Texas.' }
  }
  return validateZipForDelivery(addr.zip ?? '')
}
