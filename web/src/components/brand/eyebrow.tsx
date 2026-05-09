import { cn } from '@/lib/utils'

// Letter-spaced uppercase tag — happycake.us uses these in sky blue above
// every section heading. We render the small dot prefix when no decorator
// child is supplied so the editorial feel comes for free.
export function Eyebrow({
  children,
  className,
  decorator = '◆',
}: {
  children: React.ReactNode
  className?: string
  decorator?: string | false
}) {
  return (
    <p className={cn('eyebrow', className)}>
      {decorator && <span className="text-sky/70" aria-hidden>{decorator}</span>}
      <span>{children}</span>
    </p>
  )
}
