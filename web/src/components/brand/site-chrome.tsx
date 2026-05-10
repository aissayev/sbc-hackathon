'use client'

// Public-site chrome (header, footer, help widget) is irrelevant on the
// /admin owner cockpit — especially when the cockpit is loaded inside a
// Telegram Mini App webview, where Telegram already provides chrome and
// the public-site hamburger / footer / chat bubble just clutter a narrow
// viewport. We render NULL on /admin paths so the admin layout owns the
// full screen.

import { usePathname } from 'next/navigation'

export function SiteChrome({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  // Hide on the entire admin tree. /admin and /admin/anything → no chrome.
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return null
  return <>{children}</>
}
