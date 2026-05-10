// Smoke test for the OpenAI Whisper transcription pipeline.
// Lets you verify the integration without going through Telegram.
//
// Usage:
//   bun smoke:transcribe <path-to-audio>
//   bun smoke:transcribe path/to/voice.ogg
//   bun smoke:transcribe path/to/sample.mp3 ru
//
// Args:
//   1. audio file path (required) — .ogg, .mp3, .m4a, .wav, .webm, .flac all work
//   2. language hint (optional) — 'en' | 'ru' | 'kk'. Omit for auto-detect.
//
// Exit codes:
//   0 = success, transcript printed
//   1 = config or file error
//   2 = API error
//
// What it tells you:
//   - Whether OPENAI_API_KEY is wired
//   - Whether the file is reachable + correct format
//   - The transcript text + detected language + duration
//   - Roundtrip latency (useful to spot slow networks before the bot does)

import { readFileSync, existsSync, statSync } from 'node:fs'
import { resolve, basename } from 'node:path'
import {
  transcribeAudio,
  isTranscribeConfigured,
  type SttLanguage,
} from '../lib/transcribe.ts'

const filePath = process.argv[2]
const langArg = process.argv[3] as SttLanguage | undefined

if (!filePath) {
  console.error('usage: bun smoke:transcribe <audio-file> [en|ru|kk]')
  process.exit(1)
}

if (!isTranscribeConfigured()) {
  console.error('✗ OPENAI_API_KEY is not set. Add it to .env.local and retry.')
  process.exit(1)
}

const abs = resolve(filePath)
if (!existsSync(abs)) {
  console.error(`✗ file not found: ${abs}`)
  process.exit(1)
}

const stat = statSync(abs)
const sizeMb = (stat.size / 1024 / 1024).toFixed(2)
console.log(`→ file: ${abs} (${sizeMb} MB)`)
if (stat.size > 25 * 1024 * 1024) {
  console.error('✗ file is larger than 25MB — OpenAI Whisper rejects these. Re-encode or split.')
  process.exit(1)
}

const buf = readFileSync(abs)

const ext = abs.split('.').pop()?.toLowerCase() ?? 'ogg'
const mimeMap: Record<string, string> = {
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  mp3: 'audio/mpeg',
  m4a: 'audio/m4a',
  mp4: 'audio/mp4',
  wav: 'audio/wav',
  webm: 'audio/webm',
  flac: 'audio/flac',
}
const mimeType = mimeMap[ext] ?? 'application/octet-stream'

console.log(`→ language: ${langArg ?? 'auto-detect'}`)
console.log(`→ mime: ${mimeType}`)
console.log('→ calling OpenAI Whisper...')

const start = Date.now()
try {
  const result = await transcribeAudio(new Uint8Array(buf), {
    language: langArg,
    mimeType,
    filename: basename(abs),
  })
  const ms = Date.now() - start
  console.log()
  console.log(`✓ ${ms}ms`)
  console.log(`✓ language: ${result.languageCode ?? '(model returned no language metadata)'}`)
  if (result.durationSec) console.log(`✓ duration:  ${result.durationSec.toFixed(1)}s`)
  console.log()
  console.log('TRANSCRIPT:')
  console.log('───────────')
  console.log(result.text)
  console.log('───────────')
} catch (err) {
  console.error(`✗ failed: ${(err as Error).message}`)
  process.exit(2)
}
