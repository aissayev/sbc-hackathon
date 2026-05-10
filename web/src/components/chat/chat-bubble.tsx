'use client'

import * as React from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { formatChatText, formatChatTime, type ChatMessage } from '@/lib/use-chat'
import { findProductMentions } from '@/lib/auto-link-products'
import { fmtUsd } from '@/lib/format'

// Single chat bubble — used by both the /chat page and the help-widget mini
// chat. Sender label + bubble + timestamp. Auto-formats links and **bold**
// inside the message text via formatChatText.
//
// Image attachments: when the message text contains one or more
// `[image: /uploads/<id>.jpg]` markers (the chat widget appends these on
// upload-and-send), we strip them out of the prose and render thumbnails
// underneath. The agent's prompt also passes these markers through so the
// owner's escalation context shows the URL.
//
// Typewriter: when `message.streaming` is true the bubble reveals the text
// character-by-character (with a tiny pause on punctuation so it doesn't
// machine-gun through "Hi!" → "Hello, here's…"). While streaming we render
// plain text — markdown is applied only after the animation completes
// since partial markdown (`[Hone`) looks broken mid-stream. The hook owns
// the `streaming` flag; the bubble calls back via `onTypingComplete` to
// flip it.

const IMAGE_MARKER_RE = /\[(?:image|photo|attached):\s*([^\]\s]+)\s*\]/gi

function extractImages(text: string): { body: string; urls: string[] } {
  const urls: string[] = []
  const body = text
    .replace(IMAGE_MARKER_RE, (_, url: string) => {
      urls.push(url)
      return ''
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { body, urls }
}

// Characters revealed per millisecond. ~50 cps reads as confident
// fluent typing without feeling sluggish. Punctuation costs the equivalent
// of a few extra characters so sentences breathe.
const CHARS_PER_MS = 1 / 18
const PUNCT_BUDGET_CHARS = 5

export function ChatBubble({
  message,
  size = 'default',
  onTypingComplete,
}: {
  message: ChatMessage
  size?: 'default' | 'compact'
  onTypingComplete?: (id: string) => void
}) {
  const isUser = message.role === 'user'
  const padX = size === 'compact' ? 'px-3' : 'px-4'
  const padY = size === 'compact' ? 'py-2' : 'py-2.5'
  const text = size === 'compact' ? 'text-[13px]' : 'text-sm'
  const labelText = isUser ? 'You' : 'Happy Cake'
  const time = formatChatTime(message.ts)
  const { body, urls } = extractImages(message.text)
  // Cake photo cards: when the agent mentions a product, attach a small
  // strip of cards beneath the bubble so the customer SEES the cake
  // we're talking about. Only on assistant messages, only when not
  // streaming (avoids cards flashing in mid-typewriter), only when the
  // typewriter has caught up to a sentence boundary in `body`.
  const mentions = !isUser && !message.pending
    ? findProductMentions(body)
    : []

  // Typewriter state. When `streaming` is true we step `revealedCount` up
  // to body.length on a timer; once equal we notify the hook and the bubble
  // re-renders with the full markdown-formatted text.
  //
  // Counter lives in a ref so React Strict Mode's double-invoke + Next.js
  // Fast Refresh don't reset progress to 0. Each effect run cancels its
  // local tick chain via the closure flag and the next run picks up from
  // wherever the ref left off.
  const streaming = Boolean(message.streaming) && !message.failed && !message.pending
  const [revealedCount, setRevealedCount] = React.useState(streaming ? 0 : body.length)
  const iRef = React.useRef<number>(streaming ? 0 : body.length)
  const messageIdRef = React.useRef<string>(message.id)

  React.useEffect(() => {
    if (!streaming) {
      iRef.current = body.length
      setRevealedCount(body.length)
      return
    }
    // Genuinely new bubble → restart from 0. Same id = effect re-ran for
    // a transient reason (Strict Mode, HMR, prop identity flip), keep
    // ticking from where we were.
    if (messageIdRef.current !== message.id) {
      iRef.current = 0
      messageIdRef.current = message.id
    }
    // setInterval-based loop integrating real elapsed time. Avoids RAF
    // (which Chrome throttles to ~1Hz in background/hidden iframes) and
    // avoids the recursive-setTimeout cascade that competes with React
    // renders. Punctuation is "taxed": crossing `.,;:!?—` consumes
    // PUNCT_BUDGET_CHARS extra character-units of progress, so the
    // display pauses briefly there.
    const charCost = (idx: number) =>
      /[.,;:!?—]/.test(body[idx] ?? '') ? 1 + PUNCT_BUDGET_CHARS : 1
    let walked = 0 // residual fractional progress toward the next char
    let lastT = performance.now()
    const tick = () => {
      const now = performance.now()
      const dt = now - lastT
      lastT = now
      walked += dt * CHARS_PER_MS
      let displayed = iRef.current
      while (displayed < body.length && walked >= charCost(displayed)) {
        walked -= charCost(displayed)
        displayed += 1
      }
      if (displayed !== iRef.current) {
        iRef.current = displayed
        setRevealedCount(displayed)
      }
      if (displayed >= body.length) {
        window.clearInterval(handle)
        onTypingComplete?.(message.id)
      }
    }
    const handle = window.setInterval(tick, 30) // ~33Hz, plenty for 50 cps
    return () => {
      window.clearInterval(handle)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streaming, body, message.id])

  return (
    <div className={cn('flex flex-col gap-1 animate-fade-in', isUser ? 'items-end' : 'items-start')}>
      <div className="flex items-center gap-2 px-1">
        {!isUser && <AssistantAvatar size={size} />}
        <span className={cn('text-[10px] uppercase tracking-[0.14em] font-medium', isUser ? 'text-cocoa-900/55' : 'text-sky-700')}>
          {labelText}
        </span>
        <span className="text-[10px] text-cocoa-900/40">{time}</span>
      </div>
      <div
        className={cn(
          'max-w-[88%] rounded-2xl whitespace-pre-wrap leading-relaxed shadow-sm',
          padX,
          padY,
          text,
          isUser
            ? 'bg-cocoa-700 text-cream rounded-br-sm'
            : 'bg-cream-100 text-cocoa-900 rounded-bl-sm border border-cocoa-700/8',
          message.pending && 'opacity-70 italic',
          message.failed && 'bg-berry/10 text-berry-900 border border-berry/30',
        )}
      >
        {message.pending ? (
          <span className="inline-flex gap-1 py-0.5">
            <Dot delay="0s" />
            <Dot delay=".15s" />
            <Dot delay=".3s" />
          </span>
        ) : (
          <>
            {body && (
              streaming && revealedCount < body.length
                ? <>{body.slice(0, revealedCount)}<Caret /></>
                : formatChatText(body)
            )}
            {urls.length > 0 && (
              <div
                className={cn(
                  'flex flex-wrap gap-1.5',
                  body && 'mt-2',
                  urls.length === 1 ? 'max-w-[260px]' : '',
                )}
              >
                {urls.map((url, i) => (
                  <a
                    key={`${url}-${i}`}
                    href={url}
                    target="_blank"
                    rel="noopener"
                    className="block"
                    title="Open photo in new tab"
                  >
                    {/* Plain <img> so we don't bother with next/image domain config. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={isUser ? 'Photo you sent to Happy Cake' : 'Photo from Happy Cake'}
                      className={cn(
                        'rounded-lg object-cover',
                        urls.length === 1 ? 'max-h-56 w-auto' : 'h-20 w-20',
                        isUser ? 'border border-cream/20' : 'border border-cocoa-700/15',
                      )}
                    />
                  </a>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      {mentions.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-1.5 max-w-[88%]">
          {mentions.map((m) => (
            <Link
              key={m.id}
              href={m.href}
              className="group inline-flex items-center gap-2 rounded-xl bg-white border border-cocoa-700/12 hover:border-sky/45 hover:shadow-md transition-all p-1.5 pr-3 max-w-[230px]"
            >
              {m.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.photo_url}
                  alt={m.name}
                  className="h-10 w-10 rounded-lg object-cover shrink-0"
                  loading="lazy"
                />
              ) : (
                <div className="h-10 w-10 rounded-lg bg-cream-100 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="text-[12px] font-medium text-cocoa-900 truncate group-hover:text-sky-700 transition-colors">
                  {m.name}
                </div>
                <div className="text-[11px] text-cocoa-900/55">{fmtUsd(m.price_cents)}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

// "HC" mark in brand colors. Tiny, sits in the label row beside "Happy Cake"
// — it's the equivalent of an Intercom-style operator avatar without needing
// a real photo of Askhat. The compact size shrinks it for the widget.
function AssistantAvatar({ size }: { size: 'default' | 'compact' }) {
  const dim = size === 'compact' ? 'h-4 w-4 text-[8px]' : 'h-5 w-5 text-[9px]'
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-sky text-white font-display font-semibold leading-none shrink-0',
        dim,
      )}
    >
      HC
    </span>
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

// Blinking caret rendered at the end of the streaming text so the visitor
// sees something live. Uses tailwind's animate-pulse for the blink.
function Caret() {
  return (
    <span
      aria-hidden
      className="inline-block ml-[1px] w-[6px] h-[14px] -mb-[2px] bg-cocoa-900/55 animate-pulse"
    />
  )
}
