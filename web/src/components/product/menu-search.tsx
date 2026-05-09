'use client'

import * as React from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Search, X } from 'lucide-react'

// Lightweight client-side search field. Submits to the same /menu route with
// `?q=...`; the server component then filters in render. Debounce isn't worth
// the complexity here (10-product catalog) — Enter or blur submits.

export function MenuSearch({ defaultValue = '' }: { defaultValue?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [value, setValue] = React.useState(defaultValue)

  const submit = React.useCallback(
    (next: string) => {
      const sp = new URLSearchParams(params.toString())
      if (next.trim()) sp.set('q', next.trim())
      else sp.delete('q')
      const qs = sp.toString()
      router.push(qs ? `${pathname}?${qs}` : pathname)
    },
    [params, pathname, router],
  )

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cocoa-900/40" aria-hidden />
      <input
        type="search"
        placeholder="Search cakes (honey, pistachio, gluten-free…)"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit(value)
        }}
        onBlur={() => submit(value)}
        className="h-11 w-full rounded-md border border-cocoa-700/15 bg-white pl-9 pr-9 text-sm placeholder:text-cocoa-900/40 focus:outline-none focus:ring-2 focus:ring-sky/40"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setValue('')
            submit('')
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full text-cocoa-900/55 hover:bg-cream-100"
        >
          <X className="h-4 w-4 mx-auto" />
        </button>
      )}
    </div>
  )
}
