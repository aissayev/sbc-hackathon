// Register our public URL with the SANDBOX so it forwards inbound WA + IG
// events to our /webhooks/* routes — the canonical flow per the brief:
//
//   "Customer messages tunnel into the computer through ngrok or Cloudflare
//    Tunnel, hits the agent's bot wrapper, which calls `claude -p`."
//
// SCOPE: this registers ONLY with the sandbox MCP. For real customer
// messaging on Meta's WhatsApp Cloud API and Instagram Graph API, you also
// need to subscribe the same URL in the Meta App Dashboard (Webhooks →
// WhatsApp / Instagram → Add subscription). That's a UI step, not a script.
// See docs/05-deploy/LIVE-CHANNELS.md for the full runbook.
//
// Run it once after starting your tunnel:
//   bun run register-webhooks https://abc123.ngrok-free.app
//
// What it does:
//   1. Calls sandbox `whatsapp_register_webhook` with <url>/webhooks/whatsapp
//   2. Calls sandbox `instagram_register_webhook` with <url>/webhooks/instagram
//   3. Prints back what each registration confirmed
//
// What changes after running this:
//   - `whatsapp_inject_inbound` and `instagram_inject_dm` now actually POST
//     to our server (assuming the tunnel is up and the server is running).
//   - `world_next_event` events on those channels also get pushed to us
//     instead of us having to pull them.
//   - The eval can drive synthetic customers through the canonical webhook
//     path — exactly what the rubric scores.
//
// Real Meta webhooks (real customers on real phones) require the Meta
// Dashboard subscription step above. With BOTH registered (sandbox here +
// Meta in the dashboard), one tunnel URL serves both customer types.
//
// Idempotent — registering the same URL twice is a no-op.

import { callSandboxTool } from '../lib/sandbox-mcp.ts'

const url = process.argv[2]
if (!url || !url.startsWith('http')) {
  console.error('Usage: bun run register-webhooks <https-tunnel-url>')
  console.error('Example: bun run register-webhooks https://abc123.ngrok-free.app')
  process.exit(2)
}

const base = url.replace(/\/$/, '')
const waUrl = `${base}/webhooks/whatsapp`
const igUrl = `${base}/webhooks/instagram`

console.log('Registering webhooks with sandbox...')
console.log(`  WhatsApp → ${waUrl}`)
console.log(`  Instagram → ${igUrl}`)

const wa = await callSandboxTool('whatsapp_register_webhook', { url: waUrl })
console.log(`\nWA: ${typeof wa === 'string' ? wa : JSON.stringify(wa)}`)

const ig = await callSandboxTool('instagram_register_webhook', { url: igUrl })
console.log(`IG: ${typeof ig === 'string' ? ig : JSON.stringify(ig)}`)

console.log('\n✓ Registered. Test with:')
console.log(`  curl -X POST '${base}/webhooks/whatsapp' -H 'Content-Type: application/json' -d '{}'  # should 200`)
console.log(`  bun -e "import {callSandboxTool} from './src/lib/sandbox-mcp.ts'; await callSandboxTool('whatsapp_inject_inbound', { from: '+12815559999', message: 'webhook smoke test' })"`)
console.log(`  → watch your server logs for [whatsapp] +12815559999 → concierge`)
