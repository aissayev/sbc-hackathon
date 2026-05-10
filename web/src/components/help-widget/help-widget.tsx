'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  HelpCircle,
  X,
  ChevronRight,
  ChevronLeft,
  MessageSquareHeart,
  Package,
  Sparkles,
  Building2,
  Search as SearchIcon,
  Send,
  Paperclip,
  Image as ImageIcon,
  Phone,
  ArrowUpRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Wordmark } from '@/components/brand/wordmark'
import { TrackOrder } from './track-order'
import { ChatBubble } from '@/components/chat/chat-bubble'
import { useChat } from '@/lib/use-chat'
import { WIDGET_FAQ } from '@/lib/widget'
import { BRAND } from '@/lib/brand'

type View = 'home' | 'chat' | 'track' | 'faq'

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
const WIDGET_VIEW_KEY = 'hc_widget_view'

export function HelpWidget() {
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)
  const [view, setView] = React.useState<View>('home')
  const [popVisible, setPopVisible] = React.useState(false)

  React.useEffect(() => {
    try {
      const savedOpen = localStorage.getItem(WIDGET_OPEN_KEY)
      if (savedOpen === 'true') setOpen(true)
      const savedView = localStorage.getItem(WIDGET_VIEW_KEY) as View | null
      if (savedView === 'home' || savedView === 'chat' || savedView === 'track' || savedView === 'faq') {
        setView(savedView)
      }
    } catch {}
  }, [])

  React.useEffect(() => {
    try { localStorage.setItem(WIDGET_OPEN_KEY, String(open)) } catch {}
  }, [open])
  React.useEffect(() => {
    try { localStorage.setItem(WIDGET_VIEW_KEY, view) } catch {}
  }, [view])

  // Auto-pop teaser: dwell-time + activity gated. Accumulates "active time"
  // while the tab is visible AND the user has interacted in the last
  // IDLE_GRACE_MS. Fires once we cross AUTO_POP_DELAY_MS of active time.
  React.useEffect(() => {
    if (open) return
    if (shouldHide(pathname)) return
    let dismissed = false
    try { dismissed = localStorage.getItem(AUTO_POP_DISMISSED_KEY) === 'true' } catch {}
    if (dismissed) return

    let active = true // assume active on mount (page just loaded → user is here)
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
  React.useEffect(() => { setView('home') }, [pathname])

  function dismissPop(remember = true) {
    setPopVisible(false)
    if (remember) {
      try { localStorage.setItem(AUTO_POP_DISMISSED_KEY, 'true') } catch {}
    }
  }

  function openWidget(targetView: View = 'home') {
    setView(targetView)
    setOpen(true)
    dismissPop(true)
  }

  if (shouldHide(pathname)) return null

  return (
    <>
      <Launcher open={open} onClick={() => (open ? setOpen(false) : openWidget())} />
      {!open && popVisible && <AutoPop onOpen={() => openWidget('chat')} onDismiss={() => dismissPop(true)} />}
      {open && <Card view={view} setView={setView} onClose={() => setOpen(false)} />}
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
  view,
  setView,
  onClose,
}: {
  view: View
  setView: (v: View) => void
  onClose: () => void
}) {
  return (
    <div
      role="dialog"
      aria-label="Help and shortcuts"
      className={cn(
        'fixed z-40 bg-bakery shadow-lift overflow-hidden flex flex-col',
        // Mobile: bottom sheet that respects the launcher and dynamic toolbar.
        'inset-x-3 bottom-24 top-[max(8vh,env(safe-area-inset-top,0px))] rounded-3xl',
        // Desktop: floating card with a max-height tied to the viewport so it
        // never overflows on shorter / split-screen windows.
        'md:inset-auto md:bottom-24 md:right-6 md:top-auto md:w-[380px]',
        'md:h-[min(620px,calc(100vh-7rem))] md:max-h-[calc(100vh-7rem)] md:rounded-2xl',
        'animate-fade-in',
      )}
    >
      <CardHeader view={view} setView={setView} onClose={onClose} />
      <div className="flex-1 overflow-y-auto min-h-0">
        {view === 'home' && <HomeView setView={setView} />}
        {view === 'chat' && <ChatView />}
        {view === 'track' && (
          <div className="p-5">
            <TrackOrder />
          </div>
        )}
        {view === 'faq' && <FaqView setView={setView} />}
      </div>
      {view !== 'chat' && <CardFooter />}
    </div>
  )
}

function CardHeader({
  view,
  setView,
  onClose,
}: {
  view: View
  setView: (v: View) => void
  onClose: () => void
}) {
  const titles: Record<View, string> = {
    home: 'Hi — how can we help?',
    chat: 'Chat with Happy Cake',
    track: 'Track your order',
    faq: 'Common questions',
  }
  const subtitles: Record<View, string | null> = {
    home: null,
    chat: 'Real cake people · usually under a minute',
    track: 'Paste your order id to see live status',
    faq: 'Lead times, allergens, delivery, payment',
  }
  return (
    <div className="px-5 py-4 border-b border-cocoa-700/10 bg-cream-50">
      <div className="flex items-center justify-between gap-3">
        {view === 'home' ? (
          <Wordmark variant="wordmark-only" className="text-base" />
        ) : (
          <button
            type="button"
            onClick={() => setView('home')}
            className="text-sm text-sky-700 hover:text-sky inline-flex items-center gap-1"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="h-8 w-8 inline-flex items-center justify-center rounded-full hover:bg-cream-200 text-cocoa-900"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-2 font-display text-xl text-cocoa-900">{titles[view]}</p>
      {subtitles[view] && (
        <p className="text-xs text-cocoa-900/55 mt-0.5">{subtitles[view]}</p>
      )}
    </div>
  )
}

function HomeView({ setView }: { setView: (v: View) => void }) {
  return (
    <div className="p-3">
      <p className="px-2 pt-2 pb-3 text-xs text-cocoa-900/60">Quick options</p>
      <div className="space-y-1.5">
        <ActionRow
          icon={MessageSquareHeart}
          tone="bg-sky-100 text-sky-700"
          title="Chat with us"
          subtitle="Ask anything — what's in the case, allergens, custom cakes."
          onClick={() => setView('chat')}
          highlight
        />
        <ActionRow
          icon={Package}
          tone="bg-emerald-100 text-emerald-700"
          title="Track my order"
          subtitle="Paste an order id, get a live status."
          onClick={() => setView('track')}
        />
        <ActionRow
          icon={SearchIcon}
          tone="bg-cream-200 text-cocoa-700"
          title="FAQ"
          subtitle="Lead times, allergens, delivery, payment."
          onClick={() => setView('faq')}
        />
        <ActionRow
          icon={Sparkles}
          tone="bg-berry-100 text-berry"
          title="Customize a cake"
          subtitle="Five quick steps. Askhat quotes by phone."
          asLink
          href="/order/custom"
        />
        <ActionRow
          icon={Building2}
          tone="bg-sky-100 text-sky-700"
          title="For business"
          subtitle="Catering, gifting, standing programs. Reply within one business day."
          asLink
          href="/business"
        />
      </div>
    </div>
  )
}

function ActionRow({
  icon: Icon,
  tone,
  title,
  subtitle,
  onClick,
  href,
  asLink,
  external,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>
  tone: string
  title: string
  subtitle: string
  onClick?: () => void
  href?: string
  asLink?: boolean
  external?: boolean
  highlight?: boolean
}) {
  const inner = (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl transition-colors w-full text-left',
        highlight ? 'bg-cream-100 hover:bg-cream-200' : 'hover:bg-cream-100',
      )}
    >
      <div className={cn('h-10 w-10 rounded-full inline-flex items-center justify-center shrink-0', tone)}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-cocoa-900 text-sm">{title}</div>
        <div className="text-xs text-cocoa-900/60 leading-relaxed mt-0.5 line-clamp-2">{subtitle}</div>
      </div>
      <ChevronRight className="h-4 w-4 text-cocoa-900/35 shrink-0" />
    </div>
  )

  if (asLink && href) {
    return (
      <Link
        href={href}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener' : undefined}
        className="block"
      >
        {inner}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} className="block w-full">
      {inner}
    </button>
  )
}

const QUICK_PROMPTS = [
  "What's in the case today?",
  'Cake for ten people on Saturday?',
  'Anything without nuts?',
  'How far ahead for a custom cake?',
]

interface StagedAttachment {
  id: string
  name: string
  sizeKb: number
  type: string
  previewUrl?: string
  file: File
}

interface UploadedFile {
  url: string
  name: string
  size: number
  type: string
}

const COMPACT_MAX_ATTACHMENTS = 3
const COMPACT_MAX_FILE_KB = 8 * 1024

// Backend's /api/uploads is single-file (DO Spaces); loop on the client.
async function uploadAttachments(items: StagedAttachment[]): Promise<UploadedFile[]> {
  if (items.length === 0) return []
  const out: UploadedFile[] = []
  for (const a of items) {
    const fd = new FormData()
    fd.append('file', a.file, a.name)
    fd.append('scope', 'thread')
    const res = await fetch('/api/uploads', { method: 'POST', body: fd })
    const ct = res.headers.get('content-type') ?? ''
    if (!ct.toLowerCase().includes('application/json')) {
      throw new Error('Upload service is offline')
    }
    const data = (await res.json()) as { ok?: boolean; url?: string; type?: string; bytes?: number; reason?: string; error?: string }
    if (!res.ok || !data.ok || !data.url) {
      throw new Error(data.reason ?? data.error ?? `Upload failed (${res.status})`)
    }
    out.push({ url: data.url, name: a.name, size: data.bytes ?? a.file.size, type: data.type ?? a.type })
  }
  return out
}

function ChatView() {
  const { messages, sending, send, reset } = useChat({
    greeting:
      "Hi! I'm here to help — ask about today's bake, allergens, or custom cakes. If something's off about an order, tap the paperclip to send a photo and I'll get our owner Askhat on it.",
  })
  const [input, setInput] = React.useState('')
  const [attachments, setAttachments] = React.useState<StagedAttachment[]>([])
  const [attachError, setAttachError] = React.useState<string | null>(null)
  const logRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  React.useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  React.useEffect(() => {
    return () => {
      attachments.forEach((a) => a.previewUrl && URL.revokeObjectURL(a.previewUrl))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setAttachError(null)
    const next: StagedAttachment[] = [...attachments]
    for (const file of Array.from(fileList)) {
      if (next.length >= COMPACT_MAX_ATTACHMENTS) {
        setAttachError(`Up to ${COMPACT_MAX_ATTACHMENTS} photos.`)
        break
      }
      const sizeKb = Math.round(file.size / 1024)
      if (sizeKb > COMPACT_MAX_FILE_KB) {
        setAttachError(`"${file.name}" is over 8 MB.`)
        continue
      }
      if (!file.type.startsWith('image/')) {
        setAttachError(`"${file.name}" — only images for now.`)
        continue
      }
      const previewUrl = URL.createObjectURL(file)
      next.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        sizeKb,
        type: file.type || 'application/octet-stream',
        previewUrl,
        file,
      })
    }
    setAttachments(next)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removeAttachment(id: string) {
    setAttachments((cur) => {
      const target = cur.find((a) => a.id === id)
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
      return cur.filter((a) => a.id !== id)
    })
  }

  async function submitMessage() {
    const trimmed = input.trim()
    if ((!trimmed && attachments.length === 0) || sending) return

    let uploaded: UploadedFile[] = []
    if (attachments.length > 0) {
      try {
        uploaded = await uploadAttachments(attachments)
      } catch (err) {
        setAttachError((err as Error).message || 'Upload failed — try again.')
        return
      }
    }
    const lines = uploaded.map((f) => {
      const abs = f.url.startsWith('http') ? f.url : `${window.location.origin}${f.url}`
      return `[Photo from customer: ${abs} (${f.name})]`
    })
    const text = [trimmed, ...lines].filter(Boolean).join('\n\n')

    await send(text)
    setInput('')
    attachments.forEach((a) => a.previewUrl && URL.revokeObjectURL(a.previewUrl))
    setAttachments([])
  }

  const canSend = !sending && (input.trim().length > 0 || attachments.length > 0)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={logRef} className="flex-1 overflow-y-auto p-4 space-y-3" aria-live="polite">
        {messages.map((m) => (
          <ChatBubble key={m.id} message={m} size="compact" />
        ))}
      </div>
      {messages.length <= 1 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => send(p)}
              disabled={sending}
              className="text-[11px] px-2.5 py-1 rounded-full bg-cream-100 hover:bg-sky-100 text-cocoa-900 hover:text-sky-700 border border-cocoa-700/10 disabled:opacity-60"
            >
              {p}
            </button>
          ))}
        </div>
      )}
      {(attachments.length > 0 || attachError) && (
        <div className="px-3 pt-2 border-t border-cocoa-700/8 bg-cream-50 space-y-1.5">
          {attachments.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {attachments.map((a) => (
                <li
                  key={a.id}
                  className="inline-flex items-center gap-1.5 rounded-md border border-cocoa-700/15 bg-white pl-1.5 pr-0.5 py-0.5 text-[11px] text-cocoa-900 max-w-[180px]"
                >
                  {a.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.previewUrl} alt="" className="h-5 w-5 rounded object-cover" />
                  ) : (
                    <ImageIcon className="h-3.5 w-3.5 text-cocoa-900/55" />
                  )}
                  <span className="truncate" title={a.name}>{a.name}</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(a.id)}
                    aria-label={`Remove ${a.name}`}
                    className="h-5 w-5 inline-flex items-center justify-center rounded text-cocoa-900/55 hover:bg-cream-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {attachError && <p className="text-[11px] text-berry">{attachError}</p>}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submitMessage()
        }}
        className="border-t border-cocoa-700/10 p-2 flex items-center gap-1.5 bg-cream-50"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          className="sr-only"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending || attachments.length >= COMPACT_MAX_ATTACHMENTS}
          aria-label="Attach a photo (e.g. of a damaged cake)"
          title="Attach a photo"
          className="h-10 w-10 inline-flex items-center justify-center rounded-full text-cocoa-900/65 hover:bg-cream-100 hover:text-cocoa-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={attachments.length > 0 ? 'Add a note…' : 'Type a message…'}
          disabled={sending}
          autoComplete="off"
          className="flex-1 h-10 rounded-full bg-bakery border border-cocoa-700/15 px-4 text-sm placeholder:text-cocoa-900/40 focus:outline-none focus:ring-2 focus:ring-sky/40"
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send"
          className="h-10 w-10 inline-flex items-center justify-center rounded-full bg-sky text-white disabled:opacity-50 hover:bg-sky-700 shrink-0"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
      <div className="px-4 pb-3 pt-1 flex items-center justify-between gap-3 text-[11px] text-cocoa-900/55 border-t border-cocoa-700/8 bg-cream-50">
        <button
          type="button"
          onClick={reset}
          className="text-sky-700 hover:text-sky underline-offset-2 hover:underline"
        >
          Start over
        </button>
        <span className="inline-flex items-center gap-3">
          <a href={BRAND.phone.hrefTel} className="inline-flex items-center gap-1 hover:text-cocoa-900">
            <Phone className="h-3 w-3" /> Call
          </a>
          <Link href="/chat" className="inline-flex items-center gap-1 hover:text-cocoa-900">
            Open full chat <ArrowUpRight className="h-3 w-3" />
          </Link>
        </span>
      </div>
    </div>
  )
}

function FaqView({ setView }: { setView: (v: View) => void }) {
  return (
    <div className="p-5">
      <ul className="divide-y divide-cocoa-700/10">
        {WIDGET_FAQ.map((q) => (
          <li key={q.q}>
            <details className="group py-3">
              <summary className="cursor-pointer list-none flex items-start justify-between gap-3">
                <span className="font-medium text-cocoa-900 text-sm">{q.q}</span>
                <span className="text-sky-700 group-open:rotate-45 transition-transform shrink-0">+</span>
              </summary>
              <p className="mt-2 text-xs text-cocoa-900/75 leading-relaxed">{q.a}</p>
            </details>
          </li>
        ))}
      </ul>
      <div className="mt-5 text-xs text-cocoa-900/55">
        Still need help?{' '}
        <button
          type="button"
          onClick={() => setView('chat')}
          className="text-sky-700 hover:text-sky underline-offset-2 hover:underline"
        >
          Chat with us →
        </button>
      </div>
    </div>
  )
}

function CardFooter() {
  return (
    <div className="px-5 py-3 border-t border-cocoa-700/10 bg-cream-50 text-[11px] text-cocoa-900/55">
      We reply during open hours · Sugar Land, TX
    </div>
  )
}
