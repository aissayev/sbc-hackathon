'use client'

import * as React from 'react'
import { Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Message {
  id: string
  role: 'user' | 'assistant'
  text: string
  ts: number
  pending?: boolean
}

const STORAGE_KEY = 'hc_thread'

const SUGGESTIONS = [
  "What's in the case today?",
  'I need a cake for ten guests on Saturday.',
  'Anything without nuts?',
  'How far ahead do I order a custom cake?',
]

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

export function ChatWidget({
  seedProduct,
  productNames,
}: {
  seedProduct?: string
  productNames?: Record<string, string>
}) {
  const [threadId, setThreadId] = React.useState<string | null>(null)
  const [messages, setMessages] = React.useState<Message[]>([])
  const [input, setInput] = React.useState('')
  const [sending, setSending] = React.useState(false)
  const logRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    if (saved) setThreadId(saved)
    const greeting: Message = seedProduct
      ? {
          id: uid(),
          role: 'assistant',
          ts: Date.now(),
          text: `Hi — looking at ${productNames?.[seedProduct] ?? seedProduct.replace(/-/g, ' ')}? Tell me when you'd like it and how many people you're feeding.`,
        }
      : {
          id: uid(),
          role: 'assistant',
          ts: Date.now(),
          text:
            "Hi! What can we help with — a slice from the case, a whole cake, or something custom? I can check what's available today and draft an order for the kitchen.",
        }
    setMessages([greeting])
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [seedProduct, productNames])

  React.useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  async function send(text: string) {
    if (!text.trim() || sending) return
    setSending(true)
    const userMsg: Message = { id: uid(), role: 'user', text, ts: Date.now() }
    const pendingMsg: Message = { id: uid(), role: 'assistant', text: '…', ts: Date.now(), pending: true }
    setMessages((m) => [...m, userMsg, pendingMsg])
    setInput('')
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thread_id: threadId, text }),
      })
      const data = (await res.json()) as { thread_id?: string; replies?: string[]; error?: string }
      if (data.thread_id) {
        setThreadId(data.thread_id)
        try { localStorage.setItem(STORAGE_KEY, data.thread_id) } catch {}
      }
      const replies = data.replies?.length
        ? data.replies
        : ["I caught that, but didn't have a reply. Could you tell me a bit more?"]
      setMessages((m) => {
        const without = m.filter((x) => x.id !== pendingMsg.id)
        return [
          ...without,
          ...replies.map((text) => ({ id: uid(), role: 'assistant' as const, text, ts: Date.now() })),
        ]
      })
    } catch {
      setMessages((m) =>
        m.map((x) =>
          x.id === pendingMsg.id
            ? { ...x, pending: false, text: 'Sorry — connection hiccup. Try again in a moment?' }
            : x,
        ),
      )
    } finally {
      setSending(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  function reset() {
    setMessages([])
    setThreadId(null)
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
  }

  return (
    <div className="bakery-card overflow-hidden flex flex-col">
      <div className="px-5 py-3 border-b border-cocoa-700/10 flex items-center justify-between bg-cream-50">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden />
          <span className="text-sm font-medium text-cocoa-900">Live with the Happy Cake team</span>
        </div>
        <button
          onClick={reset}
          className="text-xs text-sky-700 hover:text-sky underline-offset-4 hover:underline"
        >
          Start over
        </button>
      </div>
      <div ref={logRef} className="p-5 space-y-3 h-[440px] overflow-y-auto" aria-live="polite">
        {messages.map((m) => (
          <Bubble key={m.id} message={m} />
        ))}
      </div>

      {messages.length <= 1 && (
        <div className="px-5 pb-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              className="text-xs px-3 py-1.5 rounded-full bg-cream-100 hover:bg-sky-100 text-cocoa-900 hover:text-sky-700 border border-cocoa-700/10 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
        className="border-t border-cocoa-700/10 p-3 flex gap-2 bg-cream-50"
      >
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="What can we help with?"
          disabled={sending}
          autoComplete="off"
          className="bg-bakery"
        />
        <Button type="submit" disabled={sending || !input.trim()} variant="sky" size="default" shape="pill" className="px-5">
          <Send className="h-4 w-4" />
          <span className="hidden sm:inline">Send</span>
        </Button>
      </form>
    </div>
  )
}

function Bubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  return (
    <div className={cn('flex animate-fade-in', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed',
          isUser
            ? 'bg-cocoa-700 text-cream rounded-br-sm'
            : 'bg-cream-100 text-cocoa-900 rounded-bl-sm border border-cocoa-700/8',
          message.pending && 'opacity-70 italic',
        )}
      >
        {message.pending ? (
          <span className="inline-flex gap-1">
            <Dot delay="0s" />
            <Dot delay=".15s" />
            <Dot delay=".3s" />
          </span>
        ) : (
          message.text
        )}
      </div>
    </div>
  )
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 rounded-full bg-cocoa-900/50 animate-pulse"
      style={{ animationDelay: delay }}
    />
  )
}
