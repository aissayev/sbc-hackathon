'use client'

import * as React from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Search, X } from 'lucide-react'

// Simple search input that submits as `?q=...` on Enter or blur. The
// list page itself is a server component that re-renders on the new
// URL, so there's nothing to do client-side except update the URL.

export function CustomersSearch({ defaultValue = '' }: { defaultValue?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [value, setValue] = React.useState(defaultValue)

  const submit = React.useCallback(
    (next: string) => {
      const sp = new URLSearchParams(params.toString())
      const trimmed = next.trim()
      if (trimmed) sp.set('q', trimmed)
      else sp.delete('q')
      const qs = sp.toString()
      router.push(qs ? `${pathname}?${qs}` : pathname)
    },
    [params, pathname, router],
  )

  return (
    <div className="relative w-full sm:w-72">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cocoa-900/40" aria-hidden />
      <input
        type="search"
        placeholder="Search name, phone, or email"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            submit(value)
          }
        }}
        onBlur={() => submit(value)}
        className="w-full h-10 pl-9 pr-9 rounded-md bg-white border border-cocoa-700/15 text-sm focus:outline-none focus:border-sky"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            setValue('')
            submit('')
          }}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-cocoa-900/55 hover:text-cocoa-900"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
