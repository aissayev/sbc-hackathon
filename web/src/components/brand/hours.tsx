import { BRAND } from '@/lib/brand'
import { cn } from '@/lib/utils'

export function HoursTable({ className }: { className?: string }) {
  return (
    <ul className={cn('divide-y divide-cocoa-700/10', className)}>
      {BRAND.hours.map((h) => {
        const closed = 'closed' in h && h.closed
        return (
          <li key={h.day} className="flex items-center justify-between py-2.5 text-sm">
            <span className="text-cocoa-900/70">{h.day}</span>
            <span className={cn('font-medium', closed ? 'text-cocoa-900/40' : 'text-cocoa-900')}>{h.value}</span>
          </li>
        )
      })}
    </ul>
  )
}

// Compute open/closed against America/Chicago (Sugar Land) regardless of
// where the server runs. Without timezone-locking, rendering on a UTC droplet
// shows Saturday-evening status to a customer browsing at 3 PM CT.
export function isOpenNow(now: Date = new Date()): { open: boolean; nextChange: string } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  })
  const parts = fmt.formatToParts(now)
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon'
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10)
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday)

  // Mon closed; Tue–Sat 11–19; Sun 12–18 (per BRAND.hours).
  if (day === 1) return { open: false, nextChange: 'Opens Tuesday at 11 AM' }
  if (day === 0) {
    if (hour < 12) return { open: false, nextChange: 'Opens at noon' }
    if (hour < 18) return { open: true, nextChange: 'Closes at 6 PM' }
    return { open: false, nextChange: 'Opens Tuesday at 11 AM' }
  }
  // Tue–Sat
  if (hour < 11) return { open: false, nextChange: 'Opens at 11 AM' }
  if (hour < 19) return { open: true, nextChange: 'Closes at 7 PM' }
  if (day === 6) return { open: false, nextChange: 'Opens Sunday at noon' }
  return { open: false, nextChange: 'Opens tomorrow at 11 AM' }
}
