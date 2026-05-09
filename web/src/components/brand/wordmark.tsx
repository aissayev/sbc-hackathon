import { cn } from '@/lib/utils'

// "HappyCake" wordmark in the display serif. The brandbook reserves a
// proper logo SVG; until that asset lands, a typographic mark covers the same
// role at every scale and stays crisp.
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'font-display tracking-tight text-2xl md:text-[26px] leading-none flex items-center gap-2',
        className,
      )}
    >
      <Cupcake className="h-6 w-6 -mb-0.5" aria-hidden />
      <span>HappyCake</span>
    </span>
  )
}

// Single-stroke cupcake-with-awning silhouette mentioned in BRANDBOOK §4.
function Cupcake({ className, ...rest }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className={className} {...rest}>
      <path d="M5 11h14l-1.4 8.2a1 1 0 0 1-1 .8H7.4a1 1 0 0 1-1-.8L5 11Z" strokeLinejoin="round" />
      <path d="M5 11c0-2.2 1.8-4 4-4 .3-1.7 1.7-3 3.5-3 1.6 0 3 1 3.4 2.5C18 6.7 19 8 19 11" strokeLinecap="round" />
      <path d="M9 14v4M12 14v4M15 14v4" strokeLinecap="round" />
    </svg>
  )
}
