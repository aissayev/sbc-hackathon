// OpenAI Whisper — speech-to-text client.
//
// Used for Telegram voice messages: the owner records a voice note in TG,
// the poller downloads the .ogg, this module turns it into text, and the
// rest of the pipeline runs as if the owner had typed it.
//
// Why OpenAI Whisper:
//   - $0.006/min (~$0.36/hr) — cheapest mainstream paid STT after Groq
//   - 99 languages including Russian, English, Kazakh — auto-detected
//   - whisper-1 + verbose_json gives us the detected language for logging
//   - One env var (OPENAI_API_KEY) most projects already have lying around
//
// Endpoint: POST https://api.openai.com/v1/audio/transcriptions
// Auth: Bearer token. Body: multipart/form-data.
// Spec: https://platform.openai.com/docs/api-reference/audio/createTranscription
//
// Model choice (OPENAI_STT_MODEL):
//   - whisper-1 (default) — supports verbose_json so we can log the
//     detected language. Best Kazakh quality.
//   - gpt-4o-mini-transcribe — ~$0.18/hr, text-only, no language echo
//   - gpt-4o-transcribe — newer, similar pricing, text-only

import { config } from '../config.ts'

const OPENAI_API = 'https://api.openai.com/v1/audio/transcriptions'

// ISO-639-1 codes. OpenAI uses these (Kazakh is `kk`, Russian `ru`,
// English `en`). We pass them straight through if the caller knows; auto-
// detection is fine for owner usage.
export type SttLanguage = 'en' | 'ru' | 'kk' | undefined

export interface TranscribeOptions {
  language?: SttLanguage
  mimeType?: string
  filename?: string
}

export interface TranscribeResult {
  text: string
  // Detected language (full English name from whisper-1's verbose_json,
  // e.g. "russian", "kazakh"). Undefined when using a model that doesn't
  // return language metadata (gpt-4o-*-transcribe).
  languageCode?: string
  // Audio duration in seconds, when the model returns it.
  durationSec?: number
  raw?: unknown
}

export class TranscribeNotConfiguredError extends Error {
  constructor() {
    super('OPENAI_API_KEY is not set; cannot transcribe audio')
    this.name = 'TranscribeNotConfiguredError'
  }
}

export function isTranscribeConfigured(): boolean {
  return Boolean(config.openai.apiKey)
}

// whisper-1 is the only OpenAI STT model that supports verbose_json. The
// gpt-4o-* transcribe models only return plain text. We fall back to plain
// json for those so we still get something useful.
function supportsVerboseJson(model: string): boolean {
  return model === 'whisper-1'
}

export async function transcribeAudio(
  audio: Uint8Array | ArrayBuffer | Blob,
  opts: TranscribeOptions = {},
): Promise<TranscribeResult> {
  const apiKey = config.openai.apiKey
  if (!apiKey) throw new TranscribeNotConfiguredError()

  const model = config.openai.sttModel
  const blob =
    audio instanceof Blob
      ? audio
      : new Blob([audio as ArrayBuffer], { type: opts.mimeType ?? 'audio/ogg' })

  const form = new FormData()
  form.append('file', blob, opts.filename ?? 'voice.ogg')
  form.append('model', model)
  if (opts.language) form.append('language', opts.language)
  if (supportsVerboseJson(model)) {
    form.append('response_format', 'verbose_json')
  }

  const res = await fetch(OPENAI_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  })

  if (!res.ok) {
    let body = ''
    try {
      body = await res.text()
    } catch {
      // ignore
    }
    throw new Error(`OpenAI STT ${res.status}: ${body.slice(0, 300)}`)
  }

  const data = (await res.json()) as {
    text?: string
    language?: string
    duration?: number
  }

  if (typeof data.text !== 'string') {
    throw new Error(`OpenAI STT returned no text: ${JSON.stringify(data).slice(0, 200)}`)
  }

  return {
    text: data.text.trim(),
    languageCode: data.language,
    durationSec: data.duration,
    raw: data,
  }
}
