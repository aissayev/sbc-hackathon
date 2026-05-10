'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight, MessageCircle, Plus, Sparkles, X } from 'lucide-react'
import { ChatView } from './chat-view'
import { formatChatTime, type ChatMessage } from '@/lib/use-chat'
import { cn } from '@/lib/utils'

// Local-storage shadow of the most recent assistant/user exchange so the
// thread-list shows a preview without needing to mount ChatView. Updated by
// ChatView via the onMessagesChange hook.
const PREVIEW_KEY = 'hc_widget_thread_preview'

interface ThreadPreview {
  lastText: string
  lastRole: 'user' | 'assistant'
  lastTs: number
  count: number
}

function readPreview(): ThreadPreview | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(PREVIEW_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ThreadPreview
  } catch {
    return null
  }
}

function writePreview(messages: ChatMessage[]) {
  if (messages.length === 0) {
    try { localStorage.removeItem(PREVIEW_KEY) } catch {}
    return
  }
  const last = messages[messages.length - 1]
  const preview: ThreadPreview = {
    lastText: last.text.length > 120 ? last.text.slice(0, 120) + '…' : last.text,
    lastRole: last.role,
    lastTs: last.ts,
    count: messages.length,
  }
  try { localStorage.setItem(PREVIEW_KEY, JSON.stringify(preview)) } catch {}
}

export function MessagesTab({
  view,
  onOpenChat,
  onBackToList,
  onClose,
}: {
  view: 'list' | 'chat'
  onOpenChat: () => void
  onBackToList: () => void
  onClose: () => void
}) {
  if (view === 'chat') {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="px-3 py-2 border-b border-cocoa-700/8 bg-cream-50 shrink-0 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onBackToList}
            className="text-sm text-sky-700 hover:text-sky inline-flex items-center gap-1"
          >
            <ChevronLeft className="h-4 w-4" /> All conversations
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="h-8 w-8 inline-flex items-center justify-center rounded-full hover:bg-cream-100 text-cocoa-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 min-h-0">
          <ChatView onMessagesChange={writePreview} />
        </div>
      </div>
    )
  }
  return <ThreadList onOpenChat={onOpenChat} />
}

function ThreadList({ onOpenChat }: { onOpenChat: () => void }) {
  const [preview, setPreview] = React.useState<ThreadPreview | null>(null)

  React.useEffect(() => {
    setPreview(readPreview())
  }, [])

  const hasThread = preview !== null && preview.count > 1 // >1 = at least one user turn beyond the greeting

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 overflow-y-auto">
        {hasThread ? (
          <ul className="divide-y divide-cocoa-700/8">
            <li>
              <button
                type="button"
                onClick={onOpenChat}
                className="w-full flex items-start gap-3 p-4 text-left hover:bg-cream-100 transition-colors"
              >
                <div className="h-10 w-10 rounded-full bg-sky/15 text-sky-700 inline-flex items-center justify-center shrink-0">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium text-cocoa-900 text-sm truncate">HappyCake team</span>
                    <span className="text-[11px] text-cocoa-900/50 shrink-0">
                      {formatChatTime(preview!.lastTs)}
                    </span>
                  </div>
                  <p
                    className={cn(
                      'text-xs mt-0.5 line-clamp-2 leading-relaxed',
                      preview!.lastRole === 'assistant' ? 'text-cocoa-900/75' : 'text-cocoa-900/60',
                    )}
                  >
                    {preview!.lastRole === 'user' ? 'You: ' : ''}
                    {preview!.lastText}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-cocoa-900/35 shrink-0 mt-3" />
              </button>
            </li>
          </ul>
        ) : (
          <EmptyState onOpenChat={onOpenChat} />
        )}
      </div>
      <div className="border-t border-cocoa-700/10 p-3 bg-cream-50">
        <button
          type="button"
          onClick={onOpenChat}
          className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-full bg-sky text-white font-medium text-sm hover:bg-sky-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          {hasThread ? 'Start a new question' : 'Ask a question'}
        </button>
      </div>
    </div>
  )
}

function EmptyState({ onOpenChat }: { onOpenChat: () => void }) {
  return (
    <div className="px-6 py-10 text-center">
      <div className="mx-auto h-14 w-14 rounded-full bg-sky/10 text-sky-700 inline-flex items-center justify-center">
        <MessageCircle className="h-7 w-7" />
      </div>
      <p className="mt-4 font-display text-lg text-cocoa-900">No messages yet</p>
      <p className="mt-1.5 text-sm text-cocoa-900/65 leading-relaxed max-w-[260px] mx-auto">
        Ask anything — what's in the case today, allergens, custom cakes. Real cake people, usually under
        a minute.
      </p>
      <button
        type="button"
        onClick={onOpenChat}
        className="mt-5 text-sm text-sky-700 hover:text-sky underline-offset-2 hover:underline font-medium"
      >
        Start a conversation →
      </button>
    </div>
  )
}
