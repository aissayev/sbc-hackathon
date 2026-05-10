// Pre-flight check. Verifies the local environment is ready to run the
// agent: tooling versions, env vars, MCP config presence, sandbox MCP
// reachability, SQLite seedability. Fast, read-only, no side effects on the
// real database.
//
// Run:  bun run preflight
//
// Exit codes:
//   0 — all green, ready to run smoke:agent
//   1 — one or more checks failed; printed report tells you which

import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { config } from '../config.ts'
import { tryCallSandboxTool } from '../lib/sandbox-mcp.ts'

interface Check {
  name: string
  status: 'pass' | 'warn' | 'fail'
  detail?: string
}

const checks: Check[] = []

function pass(name: string, detail?: string) {
  checks.push({ name, status: 'pass', detail })
}
function warn(name: string, detail: string) {
  checks.push({ name, status: 'warn', detail })
}
function fail(name: string, detail: string) {
  checks.push({ name, status: 'fail', detail })
}

// ─── Tooling ─────────────────────────────────────────────────────────────

async function which(bin: string): Promise<string | null> {
  return new Promise((resolveOuter) => {
    const proc = spawn('which', [bin])
    let out = ''
    proc.stdout.on('data', (d) => (out += d))
    proc.on('close', (code) => resolveOuter(code === 0 ? out.trim() : null))
    proc.on('error', () => resolveOuter(null))
  })
}

async function version(bin: string, args: string[] = ['--version']): Promise<string | null> {
  return new Promise((resolveOuter) => {
    const proc = spawn(bin, args)
    let out = ''
    proc.stdout.on('data', (d) => (out += d))
    proc.stderr.on('data', (d) => (out += d))
    proc.on('close', () => resolveOuter(out.trim() || null))
    proc.on('error', () => resolveOuter(null))
  })
}

const bunPath = await which('bun')
if (bunPath) pass('bun on PATH', bunPath)
else fail('bun on PATH', 'install Bun: https://bun.sh')

const claudePath = await which(config.agent.bin)
if (claudePath) {
  const v = await version(config.agent.bin)
  pass('claude CLI on PATH', `${claudePath} (${v ?? '?'})`)
} else {
  fail('claude CLI on PATH', `not found as "${config.agent.bin}"; install Claude Code or set CLAUDE_BIN`)
}

// ─── Env vars + MCP config ────────────────────────────────────────────────

if (config.sandbox.teamToken) pass('SBC_TEAM_TOKEN', 'set')
else fail('SBC_TEAM_TOKEN', 'unset — sandbox MCP calls will fail; copy .env.example to .env.local and fill in')

const mcpConfigPath = resolve('.mcp.json')
if (existsSync(mcpConfigPath)) {
  pass('.mcp.json present', mcpConfigPath)
} else {
  fail('.mcp.json present', 'run `bun run setup:mcp` to generate from template')
}

// ─── SQLite ──────────────────────────────────────────────────────────────

const dbPath = resolve(config.db.path)
if (existsSync(dbPath)) {
  const st = statSync(dbPath)
  pass('SQLite db', `${dbPath} (${(st.size / 1024).toFixed(1)} KB)`)
} else {
  warn('SQLite db', `${dbPath} not found — run \`bun run db:seed\` to initialize`)
}

// ─── Brand-RAG source file ───────────────────────────────────────────────

const brandbookPath = resolve('docs/agent-context/brand-rules.md')
if (existsSync(brandbookPath)) {
  const sectionCount = readFileSync(brandbookPath, 'utf8').split(/^##\s+/m).length - 1
  pass('brand-rules.md', `${sectionCount} sections indexed for brand_lookup`)
} else {
  warn('brand-rules.md', 'missing — brand_lookup tool will return "not found"')
}

// ─── Telegram whitelist ──────────────────────────────────────────────────

if (config.telegram.owner.token) {
  if (config.telegram.owner.chatIds.length === 0) {
    warn(
      'TG owner whitelist',
      'OPEN MODE — any chat may interact with the owner bot. Populate TG_OWNER_CHAT_IDS for prod.',
    )
  } else {
    pass('TG owner whitelist', `${config.telegram.owner.chatIds.length} chat id(s)`)
  }
} else {
  warn('TG owner bot', 'TG_OWNER_BOT_TOKEN unset — Telegram surface disabled')
}

// ─── Webhook signing secrets (production hint) ───────────────────────────

if (config.whatsapp.token) {
  if (config.whatsapp.appSecret) pass('WA_APP_SECRET', 'HMAC verification active')
  else warn('WA_APP_SECRET', 'unset — webhook bodies accepted unsigned (dev/sandbox path)')
}
if (config.instagram.token) {
  if (config.instagram.appSecret) pass('IG_APP_SECRET', 'HMAC verification active')
  else warn('IG_APP_SECRET', 'unset — webhook bodies accepted unsigned (dev/sandbox path)')
}

// ─── Sandbox MCP reachability (only if token present) ─────────────────────

if (config.sandbox.teamToken) {
  const t0 = Date.now()
  const result = await tryCallSandboxTool<unknown>('square_list_catalog', {})
  const dt = Date.now() - t0
  if (result !== null) pass('sandbox MCP reachable', `square_list_catalog OK in ${dt}ms`)
  else fail('sandbox MCP reachable', 'square_list_catalog failed — check token + URL')
}

// ─── Render report ───────────────────────────────────────────────────────

const ICON = { pass: '✓', warn: '⚠', fail: '✗' } as const
const COLOR = { pass: '\x1b[32m', warn: '\x1b[33m', fail: '\x1b[31m' } as const
const RESET = '\x1b[0m'

console.log('\nPreflight\n─────────')
for (const c of checks) {
  const line = `${COLOR[c.status]}${ICON[c.status]}${RESET} ${c.name}`
  console.log(c.detail ? `${line}  ${c.detail}` : line)
}

const fails = checks.filter((c) => c.status === 'fail').length
const warns = checks.filter((c) => c.status === 'warn').length
console.log('')
console.log(`${fails === 0 ? '✓' : '✗'} ${checks.length - fails - warns} pass · ${warns} warn · ${fails} fail`)
process.exit(fails === 0 ? 0 : 1)
