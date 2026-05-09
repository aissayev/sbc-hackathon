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
  'What\'s in the case today?',
  'I need a cake for ten guests on Saturday.',
  'Anything without nuts?',
  'How far ahead do I order a custom cake?',
]

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

export function ChatWidget({ seedProduct, productNames }: { seedProduct?: string; productNames?: Record<string, string> }) {
  const [threadId, setThreadId] = React.useState<string | null>(null)
  const [messages, setMessages] = React.useState<Message[]>([])
  const [input, setInput] = React.useState('')
  const [sending, setSending] = React.useState(false)
  const logRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Hydrate the thread id and the seeded greeting once on mount.
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
    <div className="rounded-lg border border-happy-700/15 bg-white overflow-hidden flex flex-col">
      <div className="px-5 py-3 border-b border-happy-700/10 flex items-center justify-between bg-cream-50">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-sage animate-pulse" aria-hidden />
          <span className="text-sm font-medium text-happy-900">Live with the HappyCake team</span>
        </div>
        <button
          onClick={reset}
          className="text-xs text-happy-700 hover:text-happy-900 underline-offset-4 hover:underline"
        >
          Start over
        </button>
      </div>
      <div ref={logRef} className="p-5 space-y-3 h-[420px] overflow-y-auto" aria-live="polite">
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
              className="text-xs px-3 py-1.5 rounded-full bg-cream-100 hover:bg-cream-200 text-happy-900 border border-happy-700/10"
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
        className="border-t border-happy-700/10 p-3 flex gap-2 bg-cream-50"
      >
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="What can we help with?"
          disabled={sending}
          autoComplete="off"
          className="bg-white"
        />
        <Button type="submit" disabled={sending || !input.trim()} className="px-4">
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
            ? 'bg-happy-700 text-cream-50 rounded-br-sm'
            : 'bg-cream-100 text-happy-900 rounded-bl-sm',
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
      className="inline-block h-1.5 w-1.5 rounded-full bg-happy-900/50 animate-pulse"
      style={{ animationDelay: delay }}
    />
  )
}
