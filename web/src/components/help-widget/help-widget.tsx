'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { HelpCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BottomTabs, type Tab } from './bottom-tabs'
import { HomeTab } from './home-tab'
import { MessagesTab } from './messages-tab'
import { HelpTab } from './help-tab'

// Pages where the floating launcher is suppressed: the admin console (owner
// surface) and the standalone /chat page (whose layout owns the conversation
// already). All other routes show the launcher.
function shouldHide(pathname: string | null): boolean {
  if (!pathname) return false
  if (pathname.startsWith('/admin')) return true
  if (pathname === '/chat') return true
  // /track/[code]?embed=1 renders inside an iframe on partner / our own pages;
  // a floating widget overlapping the host page would be jarring. The page's
  // embed-mode CSS hides it too, but skipping the render here saves a paint.
  if (pathname.startsWith('/track/') && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('embed') === '1') return true
  return false
}

// First-visit auto-pop:
//  - Only fires after the visitor has been on the site for AUTO_POP_DELAY_MS.
//  - Skips when the page is in the background (visibility API). Reading the
//    site in another tab → no nag.
//  - Skips on idle. We listen for any pointer / scroll / keyboard activity;
//    if none for IDLE_GRACE_MS, the dwell timer pauses. This keeps the toast
//    from popping in the user's face when they've already wandered off.
//  - One nag per browser. Dismissal persists.
const AUTO_POP_DELAY_MS = 18_000
const IDLE_GRACE_MS = 6_000
const AUTO_POP_DISMISSED_KEY = 'hc_widget_pop_dismissed'
const WIDGET_OPEN_KEY = 'hc_widget_open'
const WIDGET_TAB_KEY = 'hc_widget_tab'
const WIDGET_MSG_VIEW_KEY = 'hc_widget_msg_view'
const WIDGET_HELP_COL_KEY = 'hc_widget_help_col'

type MessageView = 'list' | 'chat'

export function HelpWidget() {
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)
  const [tab, setTab] = React.useState<Tab>('home')
  const [messageView, setMessageView] = React.useState<MessageView>('list')
  const [helpCollection, setHelpCollection] = React.useState<string | null>(null)
  const [popVisible, setPopVisible] = React.useState(false)

  React.useEffect(() => {
    try {
      const savedOpen = localStorage.getItem(WIDGET_OPEN_KEY)
      if (savedOpen === 'true') setOpen(true)
      const savedTab = localStorage.getItem(WIDGET_TAB_KEY) as Tab | null
      if (savedTab === 'home' || savedTab === 'messages' || savedTab === 'help') {
        setTab(savedTab)
      }
      const savedMsgView = localStorage.getItem(WIDGET_MSG_VIEW_KEY) as MessageView | null
      if (savedMsgView === 'list' || savedMsgView === 'chat') setMessageView(savedMsgView)
      const savedCol = localStorage.getItem(WIDGET_HELP_COL_KEY)
      if (savedCol) setHelpCollection(savedCol)
    } catch {}
  }, [])

  React.useEffect(() => {
    try { localStorage.setItem(WIDGET_OPEN_KEY, String(open)) } catch {}
  }, [open])
  React.useEffect(() => {
    try { localStorage.setItem(WIDGET_TAB_KEY, tab) } catch {}
  }, [tab])
  React.useEffect(() => {
    try { localStorage.setItem(WIDGET_MSG_VIEW_KEY, messageView) } catch {}
  }, [messageView])
  React.useEffect(() => {
    try {
      if (helpCollection) localStorage.setItem(WIDGET_HELP_COL_KEY, helpCollection)
      else localStorage.removeItem(WIDGET_HELP_COL_KEY)
    } catch {}
  }, [helpCollection])

  // Auto-pop teaser: dwell-time + activity gated. Accumulates "active time"
  // while the tab is visible AND the user has interacted in the last
  // IDLE_GRACE_MS. Fires once we cross AUTO_POP_DELAY_MS of active time.
  React.useEffect(() => {
    if (open) return
    if (shouldHide(pathname)) return
    let dismissed = false
    try { dismissed = localStorage.getItem(AUTO_POP_DISMISSED_KEY) === 'true' } catch {}
    if (dismissed) return

    let active = true
    let lastActivity = Date.now()
    let accumulated = 0
    let lastTick = Date.now()

    const events: Array<keyof DocumentEventMap> = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart']
    const onActivity = () => { lastActivity = Date.now(); active = true }
    events.forEach((e) => document.addEventListener(e, onActivity, { passive: true }))

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') active = false
      else { active = true; lastActivity = Date.now(); lastTick = Date.now() }
    }
    document.addEventListener('visibilitychange', onVisibility)

    const interval = window.setInterval(() => {
      const now = Date.now()
      const delta = now - lastTick
      lastTick = now
      const idle = now - lastActivity > IDLE_GRACE_MS
      if (active && !idle && document.visibilityState === 'visible') {
        accumulated += delta
        if (accumulated >= AUTO_POP_DELAY_MS) {
          setPopVisible(true)
          window.clearInterval(interval)
        }
      }
    }, 1_000)

    return () => {
      window.clearInterval(interval)
      events.forEach((e) => document.removeEventListener(e, onActivity))
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [open, pathname])

  // Reset to home on route change so the widget's last view doesn't stick
  // around with stale order/track data.
  React.useEffect(() => {
    setTab('home')
    setMessageView('list')
    setHelpCollection(null)
  }, [pathname])

  function dismissPop(remember = true) {
    setPopVisible(false)
    if (remember) {
      try { localStorage.setItem(AUTO_POP_DISMISSED_KEY, 'true') } catch {}
    }
  }

  function openToChat() {
    setTab('messages')
    setMessageView('chat')
    setOpen(true)
    dismissPop(true)
  }

  function openWidget() {
    setOpen(true)
    dismissPop(true)
  }

  if (shouldHide(pathname)) return null

  return (
    <>
      <Launcher open={open} onClick={() => (open ? setOpen(false) : openWidget())} />
      {!open && popVisible && <AutoPop onOpen={openToChat} onDismiss={() => dismissPop(true)} />}
      {open && (
        <Card
          tab={tab}
          messageView={messageView}
          helpCollection={helpCollection}
          onTabChange={(t) => {
            setTab(t)
            // When switching tabs, reset the sub-view of that tab so the user
            // lands on its root unless they were already in a sub-view.
            if (t === 'messages' && messageView === 'list') setMessageView('list')
            if (t === 'help') setHelpCollection(null)
          }}
          onOpenChat={() => {
            setTab('messages')
            setMessageView('chat')
          }}
          onMessageBack={() => setMessageView('list')}
          onOpenCollection={(id) => setHelpCollection(id)}
          onCollectionBack={() => setHelpCollection(null)}
          onOpenHelp={() => {
            setTab('help')
            setHelpCollection(null)
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

function Launcher({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={open ? 'Close help' : 'Open help'}
      aria-expanded={open}
      className={cn(
        'fixed z-40 rounded-full shadow-lift transition-transform hover:scale-105',
        'bottom-5 right-5 md:bottom-6 md:right-6',
        open ? 'bg-cocoa-700 text-cream' : 'bg-sky text-white',
        'h-14 w-14 inline-flex items-center justify-center',
      )}
    >
      {open ? <X className="h-6 w-6" /> : <HelpCircle className="h-6 w-6" />}
    </button>
  )
}

function AutoPop({ onOpen, onDismiss }: { onOpen: () => void; onDismiss: () => void }) {
  return (
    <div
      role="dialog"
      aria-label="Friendly hello"
      className={cn(
        'fixed z-40 bottom-24 right-5 md:right-6 max-w-[280px]',
        'rounded-2xl bg-bakery shadow-lift border border-cocoa-700/10',
        'animate-fade-in',
      )}
    >
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="absolute top-2 right-2 h-7 w-7 rounded-full text-cocoa-900/55 hover:bg-cream-100 inline-flex items-center justify-center"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onOpen}
        className="block w-full text-left px-4 py-4 pr-10"
      >
        <div className="text-xs uppercase tracking-[0.16em] text-sky-700 font-medium">Hi from Happy Cake</div>
        <p className="mt-1.5 text-sm text-cocoa-900 leading-relaxed">
          Need a hand finding a cake or planning a custom order? <span className="text-sky-700 underline">Tap to chat.</span>
        </p>
      </button>
      <span
        aria-hidden
        className="absolute -bottom-2 right-8 h-4 w-4 rotate-45 bg-bakery border-r border-b border-cocoa-700/10"
      />
    </div>
  )
}

function Card({
  tab,
  messageView,
  helpCollection,
  onTabChange,
  onOpenChat,
  onMessageBack,
  onOpenCollection,
  onCollectionBack,
  onOpenHelp,
  onClose,
}: {
  tab: Tab
  messageView: MessageView
  helpCollection: string | null
  onTabChange: (t: Tab) => void
  onOpenChat: () => void
  onMessageBack: () => void
  onOpenCollection: (id: string) => void
  onCollectionBack: () => void
  onOpenHelp: () => void
  onClose: () => void
}) {
  // The Home tab owns its own hero (gradient header), so we drop the chrome
  // header on Home for the cleanest Intercom-style top edge. Other tabs get
  // a slim chrome header with brand + close.
  const showChromeHeader = tab !== 'home'

  return (
    <div
      role="dialog"
      aria-label="Help and shortcuts"
      className={cn(
        'fixed z-40 bg-bakery shadow-lift overflow-hidden flex flex-col',
        'inset-x-3 bottom-24 top-[max(8vh,env(safe-area-inset-top,0px))] rounded-3xl',
        'md:inset-auto md:bottom-24 md:right-6 md:top-auto md:w-[380px]',
        'md:h-[min(640px,calc(100vh-7rem))] md:max-h-[calc(100vh-7rem)] md:rounded-2xl',
        'animate-fade-in',
      )}
    >
      {showChromeHeader && <ChromeHeader onClose={onClose} />}
      {tab === 'home' && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 z-20 h-8 w-8 inline-flex items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 backdrop-blur-sm"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      <div
        id={`widget-panel-${tab}`}
        role="tabpanel"
        className="flex-1 overflow-y-auto min-h-0"
      >
        {tab === 'home' && (
          <HomeTab onAsk={onOpenChat} onOpenHelp={onOpenHelp} />
        )}
        {tab === 'messages' && (
          <MessagesTab
            view={messageView}
            onOpenChat={onOpenChat}
            onBackToList={onMessageBack}
          />
        )}
        {tab === 'help' && (
          <HelpTab
            collectionId={helpCollection}
            onOpenCollection={onOpenCollection}
            onBack={onCollectionBack}
            onAsk={onOpenChat}
          />
        )}
      </div>
      <BottomTabs active={tab} onChange={onTabChange} />
    </div>
  )
}

function ChromeHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="px-4 py-3 border-b border-cocoa-700/8 flex items-center justify-end shrink-0">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="h-8 w-8 inline-flex items-center justify-center rounded-full hover:bg-cream-100 text-cocoa-900"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
