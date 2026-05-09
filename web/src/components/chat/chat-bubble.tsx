'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { formatChatText, formatChatTime, type ChatMessage } from '@/lib/use-chat'

// Single chat bubble — used by both the /chat page and the help-widget mini
// chat. Sender label + bubble + timestamp. Auto-formats links and **bold**
// inside the message text via formatChatText.
//
// Image attachments: when the message text contains one or more
// `[image: /uploads/<id>.jpg]` markers (the chat widget appends these on
// upload-and-send), we strip them out of the prose and render thumbnails
// underneath. The agent's prompt also passes these markers through so the
// owner's escalation context shows the URL.

// Separate the image markers from the prose body. Returns the cleaned text
// (with markers removed) plus an array of image URLs. Markers are matched
// loosely: `[image:` `[photo:` `[attached:` are all accepted.
const IMAGE_MARKER_RE = /\[(?:image|photo|attached):\s*([^\]\s]+)\s*\]/gi

function extractImages(text: string): { body: string; urls: string[] } {
  const urls: string[] = []
  const body = text
    .replace(IMAGE_MARKER_RE, (_, url: string) => {
      urls.push(url)
      return ''
    })
    // Collapse the empty lines we just left behind.
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { body, urls }
}

export function ChatBubble({
  message,
  size = 'default',
}: {
  message: ChatMessage
  size?: 'default' | 'compact'
}) {
  const isUser = message.role === 'user'
  const padX = size === 'compact' ? 'px-3' : 'px-4'
  const padY = size === 'compact' ? 'py-2' : 'py-2.5'
  const text = size === 'compact' ? 'text-[13px]' : 'text-sm'
  const labelText = isUser ? 'You' : 'Happy Cake'
  const time = formatChatTime(message.ts)
  const { body, urls } = extractImages(message.text)

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
            {body && formatChatText(body)}
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
