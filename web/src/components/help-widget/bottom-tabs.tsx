'use client'

import * as React from 'react'
import { Home, MessageCircle, LifeBuoy } from 'lucide-react'
import { cn } from '@/lib/utils'

export type Tab = 'home' | 'messages' | 'help'

const TABS: Array<{ id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'messages', label: 'Messages', icon: MessageCircle },
  { id: 'help', label: 'Help', icon: LifeBuoy },
]

export function BottomTabs({
  active,
  onChange,
  unreadCount,
}: {
  active: Tab
  onChange: (t: Tab) => void
  unreadCount?: number
}) {
  return (
    <nav
      role="tablist"
      aria-label="Help widget sections"
      className="border-t border-cocoa-700/10 bg-bakery flex items-stretch shrink-0"
    >
      {TABS.map(({ id, label, icon: Icon }) => {
        const isActive = id === active
        const showBadge = id === 'messages' && unreadCount && unreadCount > 0
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`widget-panel-${id}`}
            onClick={() => onChange(id)}
            className={cn(
              'relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors',
              isActive ? 'text-sky-700' : 'text-cocoa-900/55 hover:text-cocoa-900',
            )}
          >
            <span className="relative">
              <Icon className={cn('h-5 w-5', isActive && 'stroke-[2.25]')} />
              {showBadge && (
                <span
                  aria-label={`${unreadCount} unread`}
                  className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-berry text-white text-[10px] font-semibold inline-flex items-center justify-center"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </span>
            <span className={cn('text-[11px]', isActive ? 'font-semibold' : 'font-medium')}>{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
