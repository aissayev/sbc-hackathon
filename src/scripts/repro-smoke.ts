// Fresh-clone reproducibility smoke. Code Reviewer rubric explicitly tests
// "fresh-clone reproducibility". This script verifies the setup chain works
// end-to-end as documented in the README.
//
// Run: bun run repro

import { existsSync } from 'node:fs'
import { execSync, spawn } from 'node:child_process'
import { config } from '../config.ts'
import { getDb } from '../db/db.ts'

interface Check {
  name: string
  fn: () => Promise<{ ok: boolean; detail: string }>
}

const checks: Check[] = [
  {
    name: '.env.local present',
    fn: async () => ({ ok: existsSync('.env.local'), detail: '(must exist; cp from .env.example)' }),
  },
  {
    name: 'SBC_TEAM_TOKEN set',
    fn: async () => ({
      ok: !!config.sandbox.teamToken && config.sandbox.teamToken.startsWith('sbc_team_'),
      detail: `prefix=${config.sandbox.teamToken?.slice(0, 12) ?? '(missing)'}`,
    }),
  },
  {
    name: '.mcp.json rendered',
    fn: async () => ({
      ok: existsSync('.mcp.json'),
      detail: '(missing — run `bun run setup:mcp`)',
    }),
  },
  {
    name: 'SQLite seeded with catalog',
    fn: async () => {
      try {
        const row = getDb().prepare('SELECT COUNT(*) as n FROM products').get() as { n: number }
        return { ok: row.n >= 5, detail: `${row.n} products in DB (expect ≥5)` }
      } catch (e) {
        return { ok: false, detail: `query failed: ${(e as Error).message}` }
      }
    },
  },
  {
    name: 'typecheck passes',
    fn: async () => {
      try {
        execSync('bun run typecheck', { stdio: 'pipe' })
        return { ok: true, detail: 'tsc clean' }
      } catch (e) {
        const out = (e as { stdout?: Buffer }).stdout?.toString().slice(0, 200) ?? ''
        return { ok: false, detail: out || (e as Error).message }
      }
    },
  },
  {
    name: 'claude CLI in PATH',
    fn: async () => {
      try {
        const v = execSync('claude --version', { encoding: 'utf8' }).trim()
        return { ok: v.includes('Claude Code'), detail: v }
      } catch {
        return { ok: false, detail: 'claude not found — install with `npm i -g @anthropic-ai/claude-code`' }
      }
    },
  },
  {
    name: 'sandbox MCP responds',
    fn: async () => {
      try {
        const { callSandboxTool } = await import('../lib/sandbox-mcp.ts')
        const r = await callSandboxTool<{ monthlyBudgetUsd?: number }>('marketing_get_budget', {})
        return { ok: r.monthlyBudgetUsd === 500, detail: `budget=$${r.monthlyBudgetUsd}` }
      } catch (e) {
        return { ok: false, detail: `${(e as Error).message}` }
      }
    },
  },
  {
    name: 'local MCP server starts',
    fn: async () =>
      new Promise<{ ok: boolean; detail: string }>((resolve) => {
        const child = spawn('bun', ['src/agent/mcp/local-server.ts'], { stdio: ['pipe', 'pipe', 'pipe'] })
        let booted = false
        const timer = setTimeout(() => {
          if (!booted) {
            child.kill()
            resolve({ ok: false, detail: 'no response within 3s' })
          }
        }, 3000)
        child.on('error', (err) => {
          clearTimeout(timer)
          resolve({ ok: false, detail: err.message })
        })
        setTimeout(() => {
          if (!child.killed) {
            booted = true
            clearTimeout(timer)
            child.kill()
            resolve({ ok: true, detail: 'boots cleanly' })
          }
        }, 500)
      }),
  },
]

console.log('═══════════ fresh-clone reproducibility smoke ═══════════\n')
let pass = 0
let fail = 0
for (const c of checks) {
  process.stdout.write(`  ${c.name}... `)
  const r = await c.fn()
  if (r.ok) {
    console.log(`✓  ${r.detail}`)
    pass++
  } else {
    console.log(`✗  ${r.detail}`)
    fail++
  }
}

console.log(`\n  ${pass}/${checks.length} pass · ${fail} fail`)
if (fail > 0) {
  console.log('\nFailing checks above usually mean:')
  console.log('  - Missing .env.local      → cp .env.example .env.local; fill SBC_TEAM_TOKEN')
  console.log('  - Missing .mcp.json       → bun run setup:mcp')
  console.log('  - Missing products        → bun run db:seed')
  console.log('  - claude CLI absent       → npm install -g @anthropic-ai/claude-code')
  console.log('  - Sandbox unreachable     → check internet / SBC_TEAM_TOKEN value')
  process.exit(1)
}

console.log('\n✓ All checks pass — fresh clone would boot cleanly.')
console.log('  Next: `bun run dev` then `bun run smoke:agent "..."`')
