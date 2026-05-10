'use client'

import * as React from 'react'

// One-stop chat-thread hook used by both the full /chat page and the
// floating help-widget mini-chat. Persists thread_id across visits so the
// agent has continuity, and shows a graceful fallback if the backend isn't
// reachable (BACKEND_URL unset on the droplet → Next 404 HTML).

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  ts: number
  pending?: boolean
  failed?: boolean
}

const THREAD_KEY = 'hc_thread'

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

export interface UseChatOptions {
  /** Greeting injected as the first assistant message on mount. */
  greeting?: string
  /**
   * Reset the locally persisted thread on mount. Use when seeding from a
   * deep link (e.g. ?product=...) so the agent doesn't stitch unrelated
   * conversations together.
   */
  resetOnMount?: boolean
}

export interface UseChatResult {
  messages: ChatMessage[]
  sending: boolean
  threadId: string | null
  send: (text: string) => Promise<void>
  reset: () => void
}

export function useChat({ greeting, resetOnMount }: UseChatOptions = {}): UseChatResult {
  const [threadId, setThreadId] = React.useState<string | null>(null)
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [sending, setSending] = React.useState(false)

  React.useEffect(() => {
    if (resetOnMount) {
      try { localStorage.removeItem(THREAD_KEY) } catch {}
    }
    let saved: string | null = null
    try { saved = localStorage.getItem(THREAD_KEY) } catch {}
    if (saved && !resetOnMount) setThreadId(saved)
    if (greeting) {
      setMessages([{ id: uid(), role: 'assistant', text: greeting, ts: Date.now() }])
    }
    // Run once per mount; greeting/resetOnMount changes shouldn't replay.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const send = React.useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || sending) return
      setSending(true)
      const userMsg: ChatMessage = { id: uid(), role: 'user', text: trimmed, ts: Date.now() }
      const pendingId = uid()
      const pendingMsg: ChatMessage = {
        id: pendingId,
        role: 'assistant',
        text: '…',
        ts: Date.now(),
        pending: true,
      }
      setMessages((m) => [...m, userMsg, pendingMsg])

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ thread_id: threadId, text: trimmed }),
        })
        const ct = res.headers.get('content-type') ?? ''
        if (!ct.toLowerCase().includes('application/json')) {
          // Backend unreachable (Next.js rewrite returned an HTML 404).
          // Sentinel string is consumed by the catch block below.
          throw new Error('chat_backend_unreachable')
        }
        const data = (await res.json()) as { thread_id?: string; replies?: string[]; error?: string }
        if (data.thread_id) {
          setThreadId(data.thread_id)
          try { localStorage.setItem(THREAD_KEY, data.thread_id) } catch {}
        }
        const replies = data.replies?.length
          ? data.replies
          : ["I caught that, but didn't have a reply. Could you tell me a bit more?"]
        setMessages((m) => {
          const without = m.filter((x) => x.id !== pendingId)
          return [
            ...without,
            ...replies.map((t) => ({ id: uid(), role: 'assistant' as const, text: t, ts: Date.now() })),
          ]
        })
      } catch (err) {
        setMessages((m) =>
          m.map((x) =>
            x.id === pendingId
              ? {
                  ...x,
                  pending: false,
                  failed: true,
                  text:
                    (err as Error).message === 'chat_backend_unreachable'
                      ? "Chat's taking a moment to wake up. Text us at (281) 979-8320 or give it another try in a few seconds."
                      : 'Sorry — connection hiccup. Try again in a moment?',
                }
              : x,
          ),
        )
      } finally {
        setSending(false)
      }
    },
    [sending, threadId],
  )

  const reset = React.useCallback(() => {
    setMessages(greeting ? [{ id: uid(), role: 'assistant', text: greeting, ts: Date.now() }] : [])
    setThreadId(null)
    try { localStorage.removeItem(THREAD_KEY) } catch {}
  }, [greeting])

  return { messages, sending, threadId, send, reset }
}

// Tiny markdown-lite formatter for chat bubbles. Handles **bold**, autolinks
// `https://…`, and preserves newlines via whitespace-pre-wrap. Returns ready
// React nodes so the bubble component can render them inline.
export function formatChatText(text: string): React.ReactNode[] {
  // Split on newlines first to preserve paragraph breaks; each line gets
  // tokenized for links + bold.
  const lines = text.split(/\r?\n/)
  return lines.flatMap((line, lineIdx) => {
    const tokens = tokenizeLine(line, lineIdx)
    return lineIdx === lines.length - 1
      ? tokens
      : [...tokens, React.createElement('br', { key: `br-${lineIdx}` })]
  })
}

function tokenizeLine(line: string, lineIdx: number): React.ReactNode[] {
  // Handle [label](url) markdown and bare URLs.
  const out: React.ReactNode[] = []
  const pattern = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|(https?:\/\/[^\s)]+)|(\*\*([^*]+)\*\*)/g
  let lastIdx = 0
  let key = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(line)) !== null) {
    if (match.index > lastIdx) out.push(line.slice(lastIdx, match.index))
    const [, mdLink, mdLabel, mdUrl, bareUrl, , boldText] = match
    if (mdLink && mdLabel && mdUrl) {
      out.push(
        React.createElement(
          'a',
          {
            key: `${lineIdx}-${key++}`,
            href: mdUrl,
            target: '_blank',
            rel: 'noopener',
            className: 'underline hover:no-underline text-sky-700',
          },
          mdLabel,
        ),
      )
    } else if (bareUrl) {
      out.push(
        React.createElement(
          'a',
          {
            key: `${lineIdx}-${key++}`,
            href: bareUrl,
            target: '_blank',
            rel: 'noopener',
            className: 'underline hover:no-underline text-sky-700 break-all',
          },
          bareUrl,
        ),
      )
    } else if (boldText) {
      out.push(
        React.createElement(
          'strong',
          { key: `${lineIdx}-${key++}`, className: 'font-semibold' },
          boldText,
        ),
      )
    }
    lastIdx = match.index + match[0].length
  }
  if (lastIdx < line.length) out.push(line.slice(lastIdx))
  return out
}

export function formatChatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' })
}
