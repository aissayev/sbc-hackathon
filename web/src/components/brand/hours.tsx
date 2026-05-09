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

export function isOpenNow(): { open: boolean; nextChange?: string } {
  const now = new Date()
  // happycake.us hours: Mon closed, Tue–Sat 11–19, Sun 12–18 (local time).
  const day = now.getDay() // 0 = Sun
  const hour = now.getHours() + now.getMinutes() / 60
  let open = false
  let nextChange: string | undefined
  if (day === 1) {
    nextChange = 'Tomorrow at 11:00 AM'
  } else if (day === 0) {
    open = hour >= 12 && hour < 18
    nextChange = open ? 'Closes at 6:00 PM' : hour < 12 ? 'Opens at noon' : 'Opens Tuesday at 11:00 AM'
  } else {
    open = hour >= 11 && hour < 19
    nextChange = open ? 'Closes at 7:00 PM' : hour < 11 ? 'Opens at 11:00 AM' : day === 6 ? 'Opens Sunday at noon' : 'Opens tomorrow at 11:00 AM'
  }
  return { open, nextChange }
}
