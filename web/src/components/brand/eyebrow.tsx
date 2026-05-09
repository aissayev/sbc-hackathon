import { cn } from '@/lib/utils'

// "◆ HappyCake · Sugar Land" — the canonical eyebrow per BRANDBOOK §4.
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('eyebrow', className)}>◆ {children}</p>
}
