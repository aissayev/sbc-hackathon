import * as React from 'react'
import { cn } from '@/lib/utils'

// Standard page container — 1240px max width on desktop, responsive padding.
// Mirrors the `container` Tailwind class config but as a typed component so
// pages can compose it with explicit semantic intent (`<Container as="section">`)
// instead of repeating `<section className="container">` everywhere.
export function Container({
  className,
  as: Tag = 'div',
  children,
  ...rest
}: {
  as?: 'div' | 'section' | 'article' | 'header' | 'footer' | 'main' | 'aside'
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={cn('container', className)} {...rest}>
      {children}
    </Tag>
  )
}
