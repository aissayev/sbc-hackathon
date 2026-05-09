// Print current webhook registration state.
// Quick sanity check — "did the eval just drive an inbound that I'm not seeing?"
//
// Run: bun run webhooks:status

import { tryCallSandboxTool } from '../lib/sandbox-mcp.ts'

interface ThreadList {
  inbound?: Array<{ ts?: string; from?: string; message?: string }>
  outbound?: Array<{ ts?: string; to?: string; message?: string }>
  simulated?: boolean
}

const wa = await tryCallSandboxTool<ThreadList>('whatsapp_list_threads', {})
const ig = await tryCallSandboxTool<{ threads?: Array<{ threadId?: string }> } | unknown>('instagram_list_dm_threads', {})

console.log('═══ WhatsApp ═══')
if (!wa) {
  console.log('  (sandbox call failed)')
} else {
  console.log(`  inbound:  ${wa.inbound?.length ?? 0}`)
  console.log(`  outbound: ${wa.outbound?.length ?? 0}`)
  console.log(`  mode:     ${wa.simulated ? 'simulated (no real Meta creds wired)' : 'real'}`)
  if (wa.inbound && wa.inbound.length > 0) {
    console.log('  recent inbound:')
    for (const m of wa.inbound.slice(-3)) {
      console.log(`    ${m.ts} from=${m.from}  "${m.message?.slice(0, 60)}"`)
    }
  }
}

console.log('\n═══ Instagram ═══')
if (!ig) {
  console.log('  (sandbox call failed)')
} else {
  console.log(`  ${JSON.stringify(ig).slice(0, 200)}`)
}

console.log('\n═══ Setup ═══')
console.log('  If inbound = 0 and you expected events:')
console.log('  1. Is your tunnel up? (check ngrok / cloudflared output)')
console.log('  2. Is the server running on :3000? (bun run dev)')
console.log('  3. Did you register the webhook? (bun run register-webhooks <url>)')
