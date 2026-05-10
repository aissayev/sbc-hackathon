// One-shot caption drafter — wraps `claude -p` for content-studio.
//
// Why a dedicated drafter and not invokeAgent: the post-studio doesn't need
// MCP tools, history, or the customer-channel machinery. It needs a single
// sync call ("here's the brand voice + the intent → give me a caption").
// Keeping it separate keeps invoke.ts focused on the customer-channel path.
//
// Brand voice is prepended from src/agent/prompts/brand.md so output stays
// in spec without an extra LLM judge call. The brand-checker validates the
// output before it lands in the owner card.

import { spawn } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { config } from '../config.ts'
import type { DraftKind } from '../domain/content-studio/index.ts'

export interface DraftCaptionInput {
  intent: string
  kind: DraftKind
  /** Optional: live inventory / availability context to ground the draft. */
  inventory_context?: string
  /** Optional: SKUs the owner already named (for accurate cake-name format). */
  sku_hint?: string[]
}

export interface DraftCaptionResult {
  caption: string
  cost_usd: number | null
  duration_ms: number
  ok: boolean
  error?: string
}

const BRAND_PATH = resolve(import.meta.dirname ?? __dirname, 'prompts/brand.md')

function loadBrand(): string {
  if (!existsSync(BRAND_PATH)) return ''
  return readFileSync(BRAND_PATH, 'utf8')
}

function systemPrompt(input: DraftCaptionInput): string {
  const brand = loadBrand()
  const kindLines: Record<DraftKind, string> = {
    post: 'Write a single Instagram/Facebook caption. 1-3 short paragraphs. Soft CTA close. ≤3 emoji.',
    reel: 'Write a reel caption + a 1-line hook (first 3 seconds). Output the caption only; the hook will be captured separately.',
    story: 'Write a story caption — single line, ≤80 chars, conversational.',
    gbp_post: 'Write a Google Business Profile post — local, scannable, plain. No emoji header. Soft CTA close.',
    comment_reply: 'Reply to one comment. Single short paragraph, warm, no brand wordmark needed. ≤1 emoji.',
    review_reply: 'Reply to one review. Owner voice (Askhat). Acknowledge, thank, brief promise. No discount offers.',
    wa_broadcast: 'Write a one-line WhatsApp broadcast. Direct, opt-out friendly. No emoji.',
  }
  return [
    brand,
    '',
    '---',
    '',
    'You are HappyCake\'s content drafter. Apply every brand rule above.',
    '',
    `Format: ${kindLines[input.kind]}`,
    '',
    'Output ONLY the caption text. No preamble, no XML, no JSON, no markdown headers.',
  ].join('\n')
}

function userPrompt(input: DraftCaptionInput): string {
  const parts = [`Intent: ${input.intent.trim()}`]
  if (input.inventory_context) parts.push('', 'Inventory context:', input.inventory_context.trim())
  if (input.sku_hint && input.sku_hint.length > 0) {
    parts.push('', `Use these cake names verbatim: ${input.sku_hint.join(', ')}`)
  }
  return parts.join('\n')
}

export async function draftCaption(input: DraftCaptionInput): Promise<DraftCaptionResult> {
  if (!config.agent.enabled) {
    return {
      caption: '',
      cost_usd: null,
      duration_ms: 0,
      ok: false,
      error: 'agent disabled',
    }
  }
  const t0 = Date.now()
  const args = [
    '-p',
    userPrompt(input),
    '--output-format',
    'json',
    '--model',
    config.agent.model,
    '--system-prompt',
    systemPrompt(input),
  ]
  return new Promise((resolveFn) => {
    const child = spawn('claude', args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d: Buffer) => (stdout += d.toString('utf8')))
    child.stderr.on('data', (d: Buffer) => (stderr += d.toString('utf8')))
    child.on('error', (err) => {
      resolveFn({
        caption: '',
        cost_usd: null,
        duration_ms: Date.now() - t0,
        ok: false,
        error: err.message,
      })
    })
    child.on('close', (code) => {
      const duration_ms = Date.now() - t0
      if (code !== 0) {
        resolveFn({
          caption: '',
          cost_usd: null,
          duration_ms,
          ok: false,
          error: stderr.slice(0, 400) || `exit ${code}`,
        })
        return
      }
      try {
        const obj = JSON.parse(stdout) as { result?: string; total_cost_usd?: number }
        const caption = (obj.result ?? '').trim()
        resolveFn({
          caption,
          cost_usd: obj.total_cost_usd ?? null,
          duration_ms,
          ok: caption.length > 0,
          error: caption.length === 0 ? 'empty result' : undefined,
        })
      } catch (err) {
        resolveFn({
          caption: '',
          cost_usd: null,
          duration_ms,
          ok: false,
          error: `parse: ${(err as Error).message}`,
        })
      }
    })
  })
}
