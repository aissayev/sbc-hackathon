'use client'

import * as React from 'react'
import { autoLinkProducts } from './auto-link-products'

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
  // True while the bubble is typewriter-animating its text. Set when a
  // newly-arrived assistant chunk is appended; the bubble clears it once
  // the animation completes. Used to gate markdown formatting (partial
  // markdown looks broken mid-stream).
  streaming?: boolean
}

// Roughly ms per character for the typewriter timing. Punctuation pauses
// are added on top inside ChatBubble. Picked to feel like fluent typing,
// not an old-school terminal.
const MS_PER_CHAR = 18

// Pause between chunks so the prior bubble settles before the next one
// appears. Multi-paragraph replies feel like a person sending two or
// three short messages in a row, not a wall of text.
const CHUNK_PAUSE_MS = 350

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
  finishStreaming: (id: string) => void
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

    // Hydrate the visible conversation from server history, so opening
    // the help-widget after using /chat (or vice-versa) shows ONE thread,
    // not a fresh greeting + an invisible backend memory. Greeting falls
    // through when there's no saved thread or hydration returns empty.
    let cancelled = false
    async function hydrate() {
      if (saved && !resetOnMount) {
        try {
          const r = await fetch(`/api/chat/history?thread_id=${encodeURIComponent(saved)}`)
          if (r.ok) {
            const data = (await r.json()) as { messages?: Array<{ id?: string; role: 'user' | 'assistant'; text: string; ts: number }> }
            const restored = (data.messages ?? []).map((m, i) => ({
              id: m.id ?? `h_${i}`,
              role: m.role,
              text: m.text,
              ts: m.ts,
            }))
            if (!cancelled && restored.length > 0) {
              setMessages(restored)
              return
            }
          }
        } catch {
          // Backend unreachable — fall through to greeting.
        }
      }
      if (!cancelled && greeting) {
        setMessages([{ id: uid(), role: 'assistant', text: greeting, ts: Date.now() }])
      }
    }
    void hydrate()
    return () => { cancelled = true }
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
        // Drop the typing dots immediately. Each reply is split on
        // paragraph breaks so a multi-paragraph response feels like the
        // person sent two or three short messages instead of one wall.
        // Each chunk lands as a separate streaming bubble that the
        // ChatBubble typewrites; staggered so the previous chunk has time
        // to finish typing before the next one appears.
        setMessages((m) => m.filter((x) => x.id !== pendingId))
        const chunks: string[] = []
        for (const reply of replies) {
          for (const para of reply.split(/\n{2,}/)) {
            const t = para.trim()
            if (t) chunks.push(autoLinkProducts(t))
          }
        }
        let elapsed = 0
        for (const chunk of chunks) {
          const delay = elapsed
          setTimeout(() => {
            setMessages((m) => [
              ...m,
              {
                id: uid(),
                role: 'assistant' as const,
                text: chunk,
                ts: Date.now(),
                streaming: true,
              },
            ])
          }, delay)
          // Stagger the next chunk by this chunk's typing time + a pause.
          elapsed += chunk.length * MS_PER_CHAR + CHUNK_PAUSE_MS
        }
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

  // Bubble notifies the hook when its typewriter finishes so we can flip
  // `streaming` off and let downstream renders use the formatted markdown
  // (links, bold) instead of the plain stream text.
  const finishStreaming = React.useCallback((id: string) => {
    setMessages((m) => m.map((x) => (x.id === id ? { ...x, streaming: false } : x)))
  }, [])

  return { messages, sending, threadId, send, reset, finishStreaming }
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
