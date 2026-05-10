// ElevenLabs Scribe — speech-to-text client.
//
// Used for Telegram voice messages: the owner records a voice note in TG,
// the poller downloads the .ogg, this module turns it into text, and the
// rest of the pipeline runs as if the owner had typed it.
//
// Why ElevenLabs over OpenAI Whisper / self-hosted:
//   - We already have ELEVENLABS_API_KEY in the budget for TTS (brand voice
//     experiments). Reusing it adds zero new vendor surface.
//   - Scribe is multilingual (99 langs) and explicitly supports Russian,
//     English, and Kazakh — the three the owner uses.
//   - Auto language detection is on by default (omit `language_code`).
//   - Cost: ~$0.40/hr. Owner volume is < 10 min/day → effectively free.
//
// Endpoint: POST https://api.elevenlabs.io/v1/speech-to-text
// Auth: header `xi-api-key`. Body: multipart/form-data.
// Spec: https://elevenlabs.io/docs/api-reference/speech-to-text/convert

import { config } from '../config.ts'

const ELEVENLABS_API = 'https://api.elevenlabs.io/v1/speech-to-text'

export type SttLanguage = 'eng' | 'rus' | 'kaz' | undefined

export interface TranscribeOptions {
  // ISO-639-3. Omit (or undefined) for auto-detect — Scribe handles it well
  // for Russian/English/Kazakh, which is what the owner speaks.
  language?: SttLanguage
  // Override the audio MIME if the caller knows it (e.g. Telegram voice is
  // always audio/ogg with Opus). Defaults to audio/ogg.
  mimeType?: string
  // Filename for the multipart part. Cosmetic — the API doesn't care, but
  // some debug tools display it.
  filename?: string
}

export interface TranscribeResult {
  text: string
  // Detected (or echoed) language as ISO-639-3.
  languageCode?: string
  // Confidence score, 0..1. Only present when the model returns one.
  languageProbability?: number
  // Raw shape kept around for diagnostics — never logged unless debug.
  raw?: unknown
}

export class TranscribeNotConfiguredError extends Error {
  constructor() {
    super('ELEVENLABS_API_KEY is not set; cannot transcribe audio')
    this.name = 'TranscribeNotConfiguredError'
  }
}

export function isTranscribeConfigured(): boolean {
  return Boolean(config.elevenlabs.apiKey)
}

/**
 * Transcribe an audio buffer to text via ElevenLabs Scribe.
 *
 * Throws TranscribeNotConfiguredError when the API key is missing — callers
 * should catch and surface a graceful "voice transcription not configured"
 * message. Throws Error on network / API failure (5xx, malformed body).
 */
export async function transcribeAudio(
  audio: Uint8Array | ArrayBuffer | Blob,
  opts: TranscribeOptions = {},
): Promise<TranscribeResult> {
  const apiKey = config.elevenlabs.apiKey
  if (!apiKey) throw new TranscribeNotConfiguredError()

  const blob =
    audio instanceof Blob
      ? audio
      : new Blob([audio as ArrayBuffer], { type: opts.mimeType ?? 'audio/ogg' })

  const form = new FormData()
  form.append('model_id', config.elevenlabs.sttModel)
  form.append('file', blob, opts.filename ?? 'voice.ogg')
  // Omit language_code → Scribe auto-detects. We only set it if the caller
  // is confident (e.g. per-bot language preference in the future).
  if (opts.language) form.append('language_code', opts.language)
  // Drop laughter/applause tags — owner voice notes don't need them and
  // they pollute the agent's input.
  form.append('tag_audio_events', 'false')
  // Owner monologues — diarization is overhead with no benefit.
  form.append('diarize', 'false')

  const res = await fetch(ELEVENLABS_API, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },
    body: form,
  })

  if (!res.ok) {
    let body = ''
    try {
      body = await res.text()
    } catch {
      // ignore
    }
    throw new Error(`ElevenLabs STT ${res.status}: ${body.slice(0, 300)}`)
  }

  const data = (await res.json()) as {
    text?: string
    language_code?: string
    language_probability?: number
  }

  if (typeof data.text !== 'string') {
    throw new Error(`ElevenLabs STT returned no text: ${JSON.stringify(data).slice(0, 200)}`)
  }

  return {
    text: data.text.trim(),
    languageCode: data.language_code,
    languageProbability: data.language_probability,
    raw: data,
  }
}
