// WhatsApp 24h follow-up — re-engage customers whose orders completed
// >24h ago without a follow-up touch. Outputs a brand-voiced WA message
// asking "how was it?" and suggesting a Google review.
//
// Run as cron: bun src/scripts/wa-followup.ts
// Idempotent: tracks sent follow-ups in a JSON file under .data/wa-followup.json
// to avoid duplicate sends.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { getDb } from '../db/db.ts'
import { tryCallSandboxTool } from '../lib/sandbox-mcp.ts'

interface OrderRow {
  id: string
  thread_id: string
  customer_name: string | null
  customer_phone: string | null
  total_cents: number
  updated_at: number
}

const FOLLOWUP_LOG = resolve('.data/wa-followup.json')
const TWENTY_FOUR_H_MS = 24 * 60 * 60 * 1000
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000

interface FollowupLog {
  sent: Record<string, number> // order_id -> ts
}

function loadLog(): FollowupLog {
  if (!existsSync(FOLLOWUP_LOG)) return { sent: {} }
  try {
    return JSON.parse(readFileSync(FOLLOWUP_LOG, 'utf8')) as FollowupLog
  } catch {
    return { sent: {} }
  }
}

function saveLog(log: FollowupLog): void {
  mkdirSync(resolve('.data'), { recursive: true })
  writeFileSync(FOLLOWUP_LOG, JSON.stringify(log, null, 2))
}

function brandVoiceFollowup(name: string | null): string {
  const greeting = name ? `Hi ${name},` : 'Hi there,'
  return [
    greeting,
    '',
    'Hope the cake brought a good moment yesterday. If it did, a quick Google review at https://g.page/r/happycake/review would mean the world to us.',
    '',
    'Anything we should know? We read every reply.',
    '',
    '— the HappyCake team',
  ].join('\n')
}

async function main(): Promise<void> {
  const log = loadLog()
  const cutoff = Date.now() - TWENTY_FOUR_H_MS
  const horizon = Date.now() - FOURTEEN_DAYS_MS

  let candidates: OrderRow[] = []
  try {
    candidates = getDb()
      .prepare(
        `SELECT id, thread_id, customer_name, customer_phone, total_cents, updated_at
         FROM orders
         WHERE status = 'completed'
           AND updated_at < ?
           AND updated_at > ?
         ORDER BY updated_at DESC
         LIMIT 50`,
      )
      .all(cutoff, horizon) as OrderRow[]
  } catch (err) {
    console.error('[wa-followup] db query failed:', (err as Error).message)
    process.exit(1)
  }

  let sent = 0
  let skipped = 0
  for (const o of candidates) {
    if (log.sent[o.id]) {
      skipped++
      continue
    }
    if (!o.customer_phone) {
      skipped++
      continue
    }
    const msg = brandVoiceFollowup(o.customer_name)
    // Sandbox `whatsapp_send` schema is `{ to, message }`. We were passing
    // `text` here, which the sandbox silently dropped — the call returned
    // OK but the recipient saw nothing and `whatsapp_list_threads` showed
    // 0 outbound. Confirmed wrong against every other call site
    // (channels/whatsapp.ts, scripts/close-eval-gaps.ts, sandbox-mcp.ts
    // example).
    const r = await tryCallSandboxTool('whatsapp_send', {
      to: o.customer_phone,
      message: msg,
    })
    if (r) {
      log.sent[o.id] = Date.now()
      sent++
      console.log(`[wa-followup] sent to ${o.customer_phone} (order ${o.id})`)
    } else {
      console.warn(`[wa-followup] failed to send for order ${o.id}`)
    }
  }

  saveLog(log)
  console.log(`[wa-followup] done — sent ${sent}, skipped ${skipped}, candidates ${candidates.length}`)
}

main().catch((err) => {
  console.error('[wa-followup] fatal:', err)
  process.exit(1)
})
