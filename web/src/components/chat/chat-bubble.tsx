'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { formatChatText, formatChatTime, type ChatMessage } from '@/lib/use-chat'

// Single chat bubble — used by both the /chat page and the help-widget mini
// chat. Sender label + bubble + timestamp. Auto-formats links and **bold**
// inside the message text via formatChatText.

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

  return (
    <div className={cn('flex flex-col gap-1 animate-fade-in', isUser ? 'items-end' : 'items-start')}>
      <div className="flex items-center gap-2 px-1">
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
          formatChatText(message.text)
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
