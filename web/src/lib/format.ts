// Display helpers for prices, lead times, dates. Centralised so that the
// brand voice (specific quantities, plain English) is consistent everywhere.

export function fmtUsd(cents: number): string {
  const dollars = cents / 100
  return `$${dollars.toFixed(2).replace(/\.00$/, '')}`
}

export function leadTimeLabel(hours: number): string {
  if (hours < 1) return 'Right now from the case'
  if (hours === 1) return 'About an hour'
  if (hours < 24) return `${hours} hours notice`
  const days = Math.round(hours / 24)
  return `${days} day${days > 1 ? 's' : ''} notice`
}

export function fmtRelativeDate(iso: string | number | Date): string {
  const d = new Date(iso)
  const now = new Date()
  const diffH = (d.getTime() - now.getTime()) / 36e5
  if (Math.abs(diffH) < 1) return 'within the hour'
  if (diffH < 0 && diffH > -24) return `${Math.round(-diffH)}h ago`
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// Cake-name display per BRANDBOOK §2: cake "Honey", cake "Pistachio Roll".
// Applies the "cake-name in quotes after the word cake" pattern when the
// product name doesn't already contain the word "cake".
export function brandCakeName(name: string): string {
  const cleaned = name.replace(/\s*\((slice|whole)\)\s*/i, '').trim()
  if (/\bcake\b/i.test(cleaned)) return cleaned
  return `cake "${cleaned}"`
}
