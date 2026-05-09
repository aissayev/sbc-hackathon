'use client'

import * as React from 'react'
import Link from 'next/link'
import { Send, RotateCcw, Phone, MessageSquareHeart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChatBubble } from './chat-bubble'
import { useChat } from '@/lib/use-chat'
import { BRAND } from '@/lib/brand'

const SUGGESTIONS = [
  "What's in the case today?",
  'I need a cake for ten guests on Saturday.',
  'Anything without nuts?',
  'How far ahead do I order a custom cake?',
]

export function ChatWidget({
  seedProduct,
  productNames,
}: {
  seedProduct?: string
  productNames?: Record<string, string>
}) {
  const greeting = seedProduct
    ? `Hi — looking at ${productNames?.[seedProduct] ?? seedProduct.replace(/-/g, ' ')}? Tell me when you'd like it and how many people you're feeding.`
    : "Hi! What can we help with — a slice from the case, a whole cake, or something custom? I can check what's available today and draft an order for the kitchen."

  const { messages, sending, send, reset } = useChat({ greeting, resetOnMount: Boolean(seedProduct) })

  const [input, setInput] = React.useState('')
  const logRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  React.useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  return (
    <div className="bakery-card overflow-hidden flex flex-col">
      <div className="px-5 py-3 border-b border-cocoa-700/10 flex items-center justify-between bg-cream-50">
        <div className="flex items-center gap-2.5">
          <span className="relative inline-flex items-center justify-center h-8 w-8 rounded-full bg-sky/15 text-sky-700">
            <MessageSquareHeart className="h-4 w-4" />
            <span
              aria-hidden
              className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-cream-50 animate-pulse"
            />
          </span>
          <div>
            <div className="text-sm font-medium text-cocoa-900">Happy Cake — live</div>
            <div className="text-[11px] text-cocoa-900/55">Real cake people · usually under a minute</div>
          </div>
        </div>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1 text-xs text-sky-700 hover:text-sky underline-offset-4 hover:underline"
        >
          <RotateCcw className="h-3 w-3" /> Start over
        </button>
      </div>

      <div ref={logRef} className="p-5 space-y-3 h-[440px] overflow-y-auto" aria-live="polite">
        {messages.map((m) => (
          <ChatBubble key={m.id} message={m} />
        ))}
      </div>

      {messages.length <= 1 && (
        <div className="px-5 pb-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              disabled={sending}
              className="text-xs px-3 py-1.5 rounded-full bg-cream-100 hover:bg-sky-100 text-cocoa-900 hover:text-sky-700 border border-cocoa-700/10 transition-colors disabled:opacity-60"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!input.trim() || sending) return
          send(input)
          setInput('')
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

      <div className="px-5 py-3 border-t border-cocoa-700/8 bg-cream-50 flex items-center justify-between text-[11px] text-cocoa-900/55">
        <span>Drafts queue for owner approval before the kitchen starts.</span>
        <Link href={BRAND.phone.hrefTel} className="inline-flex items-center gap-1 hover:text-cocoa-900">
          <Phone className="h-3 w-3" /> {BRAND.phone.display}
        </Link>
      </div>
    </div>
  )
}
