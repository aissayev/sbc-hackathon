'use client'

import * as React from 'react'
import Link from 'next/link'
import { Send, Paperclip, X, Image as ImageIcon, Phone, ArrowUpRight, UserRound } from 'lucide-react'
import { ChatBubble } from '@/components/chat/chat-bubble'
import { useChat, type ChatMessage } from '@/lib/use-chat'
import { BRAND } from '@/lib/brand'

const QUICK_PROMPTS = [
  "What's in the case today?",
  'Cake for ten people on Saturday?',
  'Anything without nuts?',
  'How far ahead for a custom cake?',
]

// Standardised phrasing for the "talk to a person" hand-off — sent by the
// chat as a regular user turn so the agent's existing escalation path
// (concierge prompt → escalate_to_owner) handles it. The customer never
// leaves the channel; a human replies in the same widget.
const HUMAN_HANDOFF_TEXT = "I'd like to talk to a person, please."

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

export function ChatView({
  onMessagesChange,
}: {
  onMessagesChange?: (messages: ChatMessage[]) => void
}) {
  const { messages, sending, send, reset, finishStreaming } = useChat({
    greeting:
      "Hi — the HappyCake team here. Ask about today's bake, allergens, custom cakes, or your order. If something's off, tap the paperclip to send a photo and we'll make it right. What can we help with?",
  })
  const [input, setInput] = React.useState('')
  const [attachments, setAttachments] = React.useState<StagedAttachment[]>([])
  const [attachError, setAttachError] = React.useState<string | null>(null)
  const logRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
    onMessagesChange?.(messages)
  }, [messages, onMessagesChange])

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
          <ChatBubble key={m.id} message={m} size="compact" onTypingComplete={finishStreaming} />
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
      <div className="px-4 pb-3 pt-1 flex items-center justify-between gap-3 text-[11px] text-cocoa-900/55 bg-cream-50">
        <div className="inline-flex items-center gap-3">
          <button
            type="button"
            onClick={reset}
            disabled={sending}
            className="text-sky-700 hover:text-sky underline-offset-2 hover:underline disabled:opacity-50"
          >
            Start over
          </button>
          {/* Same-channel hand-off. The concierge prompt routes this exact
              phrasing through escalate_to_owner with reason
              owner_requested_by_customer; a human replies in this same
              widget thread. No redirect to phone/WhatsApp. */}
          <button
            type="button"
            onClick={() => send(HUMAN_HANDOFF_TEXT)}
            disabled={sending}
            className="inline-flex items-center gap-1 text-sky-700 hover:text-sky underline-offset-2 hover:underline disabled:opacity-50"
          >
            <UserRound className="h-3 w-3" />
            Talk to a person
          </button>
        </div>
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
