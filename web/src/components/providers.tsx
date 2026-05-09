'use client'

import * as React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Single React Query client for the website. Defaults tuned for cake-shop UX:
// - 30s stale time so revisiting a page within a session doesn't spam the
//   backend; we still revalidate when the tab regains focus.
// - 1 retry only — most failures are user-fixable (typoed order id, network
//   blip), not transient server errors worth retrying hard.
function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: true,
      },
      mutations: { retry: 0 },
    },
  })
}

export function Providers({ children }: { children: React.ReactNode }) {
  // Lazily create the client per-mount so server-render doesn't share state
  // across requests. `useState` is the standard pattern here.
  const [client] = React.useState(makeClient)
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
