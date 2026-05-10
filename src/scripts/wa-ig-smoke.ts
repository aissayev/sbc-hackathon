// Real-channel smoke for WhatsApp + Instagram.
//
// Run pre-demo to verify the round-trip works end-to-end before sending
// a message from a real phone:
//
//   bun run wa-ig:smoke
//
// Each step is independent — a fail in one doesn't pin the rest. Final
// exit code is the count of failed steps.
//
// What it checks:
//   1. Backend reachable on :3000 (or BASE_URL)
//   2. Channel status reports (WA + IG)
//   3. Real-creds detection — flags sandbox-only mode loudly so you
//      don't waste time wondering why a real phone never gets a reply
//   4. Local webhook GET verification (Meta's hub.challenge handshake)
//   5. Public webhook GET verification (if NGROK_URL or PUBLIC_URL set)
//   6. Sandbox inbound injection — fires a synthetic WA message and IG
//      DM through the sandbox MCP, then checks /api/admin/logs to see
//      that the agent processed both
//   7. Real outbound — only if WA_TOKEN / IG_TOKEN are set, sends a
//      no-op send to confirm the credential is still valid
//
// What it does NOT check (out of scope for an automated smoke):
//   - That a real phone receives the message (humans-only verification)
//   - That Meta has subscribed your webhook subscription (visible in
//     the Meta dev console). Run `bun run webhooks:status` for that.

import { config } from '../config.ts'
import { tryCallSandboxTool, SandboxMcpError } from '../lib/sandbox-mcp.ts'

const BASE = process.env.BASE_URL ?? `http://localhost:${config.port}`
const PUBLIC = process.env.NGROK_URL ?? config.publicUrl ?? ''

interface StepResult {
  ok: boolean
  detail: string
  warn?: boolean
}

interface Step {
  name: string
  run: () => Promise<StepResult>
}

const steps: Step[] = []

// ─── 1. Backend reachability ────────────────────────────────────────────
steps.push({
  name: 'backend reachable',
  run: async () => {
    try {
      const r = await fetch(`${BASE}/api/admin/channels`)
      if (r.ok) return { ok: true, detail: `${BASE} is up` }
      return { ok: false, detail: `${BASE} returned HTTP ${r.status}` }
    } catch (err) {
      return {
        ok: false,
        detail: `cannot reach ${BASE}: ${(err as Error).message}. Start with \`bun run dev\`.`,
      }
    }
  },
})

// ─── 2. Channel statuses + real-creds detection ─────────────────────────
interface ChannelStatus {
  id: string
  connected?: boolean
  mode?: string
  threadCount?: number
  lastEventAt?: number
}

let waStatus: ChannelStatus | undefined
let igStatus: ChannelStatus | undefined

steps.push({
  name: 'WA channel registered',
  run: async () => {
    const r = await fetch(`${BASE}/api/admin/channels`)
    const data = (await r.json()) as { channels: ChannelStatus[] }
    waStatus = data.channels.find((c) => c.id === 'whatsapp')
    if (!waStatus) return { ok: false, detail: 'whatsapp channel missing from /api/admin/channels' }
    if (!waStatus.connected) return { ok: false, detail: `connected=false, mode=${waStatus.mode}` }
    return { ok: true, detail: `connected · mode=${waStatus.mode} · threads=${waStatus.threadCount ?? 0}` }
  },
})

steps.push({
  name: 'IG channel registered',
  run: async () => {
    const r = await fetch(`${BASE}/api/admin/channels`)
    const data = (await r.json()) as { channels: ChannelStatus[] }
    igStatus = data.channels.find((c) => c.id === 'instagram')
    if (!igStatus) return { ok: false, detail: 'instagram channel missing from /api/admin/channels' }
    if (!igStatus.connected) return { ok: false, detail: `connected=false, mode=${igStatus.mode}` }
    return { ok: true, detail: `connected · mode=${igStatus.mode} · threads=${igStatus.threadCount ?? 0}` }
  },
})

// ─── 3. Real-creds detection (warns when sandbox-only) ──────────────────
const waReal = Boolean(config.whatsapp.token && config.whatsapp.phoneNumberId)
const igReal = Boolean(config.instagram.token && config.instagram.userId)

steps.push({
  name: 'WA real-Meta creds',
  run: async () => {
    if (!waReal) {
      return {
        ok: false,
        warn: true,
        detail: 'WA_TOKEN or WA_PHONE_NUMBER_ID unset. Sandbox-only mode — real phones will not receive replies.',
      }
    }
    return {
      ok: true,
      detail: `WA_TOKEN ${config.whatsapp.token!.slice(0, 8)}…  · phone=${config.whatsapp.phoneNumberId}`,
    }
  },
})

steps.push({
  name: 'IG real-Meta creds',
  run: async () => {
    if (!igReal) {
      return {
        ok: false,
        warn: true,
        detail: 'IG_TOKEN or IG_USER_ID unset. Sandbox-only mode — real DMs will not receive replies.',
      }
    }
    return {
      ok: true,
      detail: `IG_TOKEN ${config.instagram.token!.slice(0, 8)}…  · user=${config.instagram.userId}`,
    }
  },
})

// ─── 4. Local webhook GET verification ─────────────────────────────────
async function verifyHandshake(channel: 'whatsapp' | 'instagram', base: string, label: string): Promise<StepResult> {
  const verifyToken =
    channel === 'whatsapp' ? config.whatsapp.verifyToken : config.instagram.verifyToken
  const challenge = `smoke_${Date.now()}`
  const url = `${base}/webhooks/${channel}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(verifyToken)}&hub.challenge=${challenge}`
  try {
    const r = await fetch(url)
    const body = (await r.text()).trim()
    if (!r.ok) return { ok: false, detail: `${label} returned HTTP ${r.status}` }
    if (body !== challenge) return { ok: false, detail: `${label} echoed ${body.slice(0, 60)} instead of ${challenge}` }
    return { ok: true, detail: `${label} echoed challenge` }
  } catch (err) {
    return { ok: false, detail: `${label} fetch failed: ${(err as Error).message}` }
  }
}

steps.push({
  name: 'WA webhook GET (local)',
  run: () => verifyHandshake('whatsapp', BASE, 'local'),
})
steps.push({
  name: 'IG webhook GET (local)',
  run: () => verifyHandshake('instagram', BASE, 'local'),
})

// ─── 5. Public (tunneled) webhook GET verification ─────────────────────
if (PUBLIC) {
  steps.push({
    name: 'WA webhook GET (public)',
    run: () => verifyHandshake('whatsapp', PUBLIC, `public ${PUBLIC}`),
  })
  steps.push({
    name: 'IG webhook GET (public)',
    run: () => verifyHandshake('instagram', PUBLIC, `public ${PUBLIC}`),
  })
} else {
  steps.push({
    name: 'public webhook GET',
    run: async () => ({
      ok: false,
      warn: true,
      detail: 'NGROK_URL / PUBLIC_URL unset — skipping public-URL handshake check. Start `ngrok http 3000` and re-run.',
    }),
  })
}

// ─── 6. Sandbox inbound injection ───────────────────────────────────────
// Two test modes:
//   - WITH tunnel (NGROK_URL set + webhook registered): full round-trip.
//     Inject a synthetic inbound, then poll /admin/logs for the agent_call.
//   - WITHOUT tunnel: inject only verifies the sandbox accepts our payload
//     shape. The sandbox response says "no webhook registered — agent will
//     only see this via *_list_threads" so we just confirm the API call
//     succeeds. The round-trip itself is a separate concern.
const SMOKE_PHONE = '+12815559001' // sandbox-tracked test number
const SMOKE_IG_HANDLE = 'smoke_test' // bare handle (no @) — sandbox normalizes
const HAS_TUNNEL = Boolean(PUBLIC)

async function pollForLog(
  channel: 'whatsapp' | 'instagram',
  sinceMs: number,
  timeoutMs = 30_000,
): Promise<{ ok: boolean; matchedAt?: number; tries: number }> {
  const start = Date.now()
  let tries = 0
  while (Date.now() - start < timeoutMs) {
    tries++
    const r = await fetch(`${BASE}/api/admin/logs?channel=${channel}&limit=20`)
    if (r.ok) {
      const data = (await r.json()) as { rows: Array<{ at: number; kind: string; outcome: string }> }
      const match = data.rows.find((row) => row.at >= sinceMs && row.kind === 'agent_call')
      if (match) return { ok: true, matchedAt: match.at, tries }
    }
    await new Promise((res) => setTimeout(res, 2_000))
  }
  return { ok: false, tries }
}

steps.push({
  name: 'WA sandbox inject',
  run: async () => {
    const sentAt = Date.now()
    let resp: unknown
    try {
      resp = await tryCallSandboxTool('whatsapp_inject_inbound', {
        from: SMOKE_PHONE,
        message: `[smoke ${sentAt}] do you have honey cake today?`,
      })
    } catch (err) {
      return { ok: false, detail: `sandbox rejected: ${(err as Error).message}` }
    }
    if (resp == null) return { ok: false, detail: 'sandbox returned null' }
    if (!HAS_TUNNEL) {
      return {
        ok: true,
        warn: true,
        detail: `sandbox accepted (no tunnel — agent does not run; see ${PUBLIC || 'NGROK_URL'} note above)`,
      }
    }
    const result = await pollForLog('whatsapp', sentAt)
    if (!result.ok) {
      return { ok: false, detail: `tunnel up but agent did not run within 30s (${result.tries} polls). Did you register the webhook?` }
    }
    return { ok: true, detail: `agent processed within ${((result.matchedAt! - sentAt) / 1000).toFixed(1)}s (${result.tries} polls)` }
  },
})

steps.push({
  name: 'IG sandbox inject',
  run: async () => {
    const sentAt = Date.now()
    let resp: unknown
    try {
      resp = await tryCallSandboxTool('instagram_inject_dm', {
        threadId: SMOKE_IG_HANDLE,
        from: SMOKE_IG_HANDLE,
        message: `[smoke ${sentAt}] any pistachio rolls left?`,
      })
    } catch (err) {
      return { ok: false, detail: `sandbox rejected: ${(err as Error).message}` }
    }
    if (resp == null) return { ok: false, detail: 'sandbox returned null' }
    if (!HAS_TUNNEL) {
      return {
        ok: true,
        warn: true,
        detail: `sandbox accepted (no tunnel — agent does not run)`,
      }
    }
    const result = await pollForLog('instagram', sentAt)
    if (!result.ok) {
      return { ok: false, detail: `tunnel up but agent did not run within 30s (${result.tries} polls). Did you register the webhook?` }
    }
    return { ok: true, detail: `agent processed within ${((result.matchedAt! - sentAt) / 1000).toFixed(1)}s (${result.tries} polls)` }
  },
})

// ─── 7. Real outbound (only when real creds detected) ───────────────────
if (waReal) {
  steps.push({
    name: 'WA real outbound (Cloud API)',
    run: async () => {
      // We don't actually send a message here — that would charge Meta and
      // ping a real phone. We just probe the Graph API with a malformed
      // body and read the response. A 400 with a valid Meta error envelope
      // means the credential is alive; 401/403 means token expired.
      const url = `https://graph.facebook.com/v25.0/${config.whatsapp.phoneNumberId}/messages`
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.whatsapp.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        })
        const body = (await r.text()).slice(0, 200)
        if (r.status === 401 || r.status === 403) {
          return { ok: false, detail: `auth failed (HTTP ${r.status}) — WA_TOKEN expired? ${body}` }
        }
        if (r.status === 400) {
          // Expected — empty body triggers Meta's "param missing" error.
          // The fact that we got a 400 (not 401/403) means the token is good.
          return { ok: true, detail: 'token alive (400 on probe; expected — token would auth a real send)' }
        }
        return { ok: true, detail: `unexpected ${r.status} but no auth fail: ${body}` }
      } catch (err) {
        return { ok: false, detail: `Cloud API unreachable: ${(err as Error).message}` }
      }
    },
  })
}

if (igReal) {
  steps.push({
    name: 'IG real outbound (Graph API)',
    run: async () => {
      const url = `https://graph.instagram.com/v25.0/${config.instagram.userId}/messages`
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.instagram.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        })
        const body = (await r.text()).slice(0, 200)
        if (r.status === 401 || r.status === 403) {
          return { ok: false, detail: `auth failed (HTTP ${r.status}) — IG_TOKEN expired? ${body}` }
        }
        if (r.status === 400) {
          return { ok: true, detail: 'token alive (400 on probe; expected)' }
        }
        return { ok: true, detail: `unexpected ${r.status} but no auth fail: ${body}` }
      } catch (err) {
        return { ok: false, detail: `Graph API unreachable: ${(err as Error).message}` }
      }
    },
  })
}

// ─── Run all steps + print scoreboard ───────────────────────────────────
console.log('═════════ wa-ig:smoke ═════════')
console.log(`backend: ${BASE}`)
console.log(`public:  ${PUBLIC || '(unset)'}`)
console.log(`steps:   ${steps.length}\n`)

let pass = 0
let fail = 0
let warn = 0
for (const [i, step] of steps.entries()) {
  const t0 = Date.now()
  process.stdout.write(`${String(i + 1).padStart(2)}. ${step.name.padEnd(34)} … `)
  let r: StepResult
  try {
    r = await step.run()
  } catch (err) {
    r = { ok: false, detail: (err as Error).message }
  }
  const dur = Date.now() - t0
  if (r.ok) {
    pass++
    console.log(`✓ (${dur}ms)`)
  } else if (r.warn) {
    warn++
    console.log(`⚠ (${dur}ms)`)
  } else {
    fail++
    console.log(`✗ (${dur}ms)`)
  }
  console.log(`     ${r.detail}`)
}

console.log(`\n${pass} pass · ${warn} warn · ${fail} fail · ${steps.length} total`)
if (waReal && igReal && fail === 0 && warn === 0) {
  console.log('\n✓ Real-channel ready. Send a message from your phone now — it should land in /admin/logs and your owner bot.')
}
process.exit(fail === 0 ? 0 : 1)

// Suppress unused-import warning when SandboxMcpError isn't referenced.
void SandboxMcpError
