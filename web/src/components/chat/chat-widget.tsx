'use client'

import * as React from 'react'
import Link from 'next/link'
import { Send, RotateCcw, Phone, MessageSquareHeart, Paperclip, X, Image as ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChatBubble } from './chat-bubble'
import { useChat } from '@/lib/use-chat'
import { BRAND } from '@/lib/brand'
import { cn } from '@/lib/utils'

const SUGGESTIONS = [
  "What's in the case today?",
  'I need a cake for ten guests on Saturday.',
  'Anything without nuts?',
  'How far ahead do I order a custom cake?',
]

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

const MAX_ATTACHMENTS = 3
const MAX_FILE_KB = 8 * 1024 // 8 MB per file

// Backend's /api/uploads is single-file (DO Spaces). Loop on the client so
// callers can keep passing a list of staged attachments.
async function uploadAttachments(items: StagedAttachment[], scopeId?: string): Promise<UploadedFile[]> {
  if (items.length === 0) return []
  const out: UploadedFile[] = []
  for (const a of items) {
    const fd = new FormData()
    fd.append('file', a.file, a.name)
    fd.append('scope', 'thread')
    if (scopeId) fd.append('scope_id', scopeId)
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

  const { messages, sending, send, reset, finishStreaming } = useChat({ greeting, resetOnMount: Boolean(seedProduct) })

  const [input, setInput] = React.useState('')
  const [attachments, setAttachments] = React.useState<StagedAttachment[]>([])
  const [attachError, setAttachError] = React.useState<string | null>(null)
  const logRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  React.useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  React.useEffect(() => {
    return () => {
      attachments.forEach((a) => a.previewUrl && URL.revokeObjectURL(a.previewUrl))
    }
    // intentionally empty: cleanup runs on unmount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setAttachError(null)
    const next: StagedAttachment[] = [...attachments]
    for (const file of Array.from(fileList)) {
      if (next.length >= MAX_ATTACHMENTS) {
        setAttachError(`Up to ${MAX_ATTACHMENTS} photos per message.`)
        break
      }
      const sizeKb = Math.round(file.size / 1024)
      if (sizeKb > MAX_FILE_KB) {
        setAttachError(`"${file.name}" is over 8 MB — try a smaller photo.`)
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

  async function handleSend() {
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

    // Photos go on their own line as fully-qualified URLs the agent can read.
    // The concierge prompt teaches the bot to recognise these as customer
    // proof and forward / acknowledge accordingly.
    const photoLines = uploaded.map((f) => {
      const abs = f.url.startsWith('http') ? f.url : `${window.location.origin}${f.url}`
      return `[Photo from customer: ${abs} (${f.name})]`
    })
    const text = [trimmed, ...photoLines].filter(Boolean).join('\n\n')

    await send(text)
    setInput('')
    attachments.forEach((a) => a.previewUrl && URL.revokeObjectURL(a.previewUrl))
    setAttachments([])
  }

  const canSend = !sending && (input.trim().length > 0 || attachments.length > 0)

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
          <ChatBubble key={m.id} message={m} onTypingComplete={finishStreaming} />
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

      {(attachments.length > 0 || attachError) && (
        <div className="px-5 pt-3 border-t border-cocoa-700/8 bg-cream-50 space-y-2">
          {attachments.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {attachments.map((a) => (
                <li
                  key={a.id}
                  className="group inline-flex items-center gap-2 rounded-lg border border-cocoa-700/15 bg-white pl-2 pr-1 py-1 text-xs text-cocoa-900 max-w-[220px]"
                >
                  {a.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.previewUrl}
                      alt=""
                      className="h-7 w-7 rounded-md object-cover border border-cocoa-700/10"
                    />
                  ) : (
                    <ImageIcon className="h-4 w-4 text-cocoa-900/55" />
                  )}
                  <span className="truncate" title={`${a.name} · ${a.sizeKb} KB`}>
                    {a.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(a.id)}
                    aria-label={`Remove ${a.name}`}
                    className="h-6 w-6 inline-flex items-center justify-center rounded-md text-cocoa-900/55 hover:bg-cream-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {attachError && (
            <p className="text-xs text-berry" role="alert">
              {attachError}
            </p>
          )}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSend()
        }}
        className="border-t border-cocoa-700/10 p-3 flex items-center gap-2 bg-cream-50"
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
          disabled={sending || attachments.length >= MAX_ATTACHMENTS}
          aria-label="Attach a photo (e.g. of a damaged cake)"
          title="Attach a photo"
          className={cn(
            'inline-flex h-11 w-11 items-center justify-center rounded-full text-cocoa-900/70 hover:bg-cream-100 hover:text-cocoa-900 transition-colors',
            'disabled:cursor-not-allowed disabled:opacity-40 shrink-0',
          )}
        >
          <Paperclip className="h-5 w-5" />
        </button>
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={attachments.length > 0 ? 'Add a note about the photo…' : 'What can we help with?'}
          disabled={sending}
          autoComplete="off"
          className="bg-bakery"
        />
        <Button type="submit" disabled={!canSend} variant="sky" size="default" shape="pill" className="px-5 shrink-0">
          <Send className="h-4 w-4" />
          <span className="hidden sm:inline">Send</span>
        </Button>
      </form>

      <div className="px-5 py-3 border-t border-cocoa-700/8 bg-cream-50 flex items-center justify-between text-[11px] text-cocoa-900/55 gap-3">
        <span className="truncate">Drafts queue for owner approval before the kitchen starts.</span>
        <Link href={BRAND.phone.hrefTel} className="inline-flex items-center gap-1 hover:text-cocoa-900 shrink-0">
          <Phone className="h-3 w-3" /> {BRAND.phone.display}
        </Link>
      </div>
    </div>
  )
}
