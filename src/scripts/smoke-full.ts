// Pre-submission smoke aggregator. Runs every gate the rubric judges in one
// command and exits non-zero on any failure.
//
// Used in two places:
//   1. Local pre-submission verification (`bun run smoke:full`).
//   2. CI-style sanity check before tagging a release.
//
// Each step is its own subprocess so a hang in one doesn't pin the others.
// The aggregator reports pass/fail with timing, then exits with the count of
// failures (0 if green).

import { spawnSync } from 'node:child_process'

interface Step {
  name: string
  cmd: string
  args: string[]
  // Some steps cost real money (claude -p / sandbox MCP); flag them so we can
  // skip in cheap mode.
  costsMoney?: boolean
}

const STEPS: Step[] = [
  { name: 'typecheck (backend)', cmd: 'bun', args: ['run', 'typecheck'] },
  { name: 'typecheck (web)', cmd: 'bun', args: ['run', '--cwd', 'web', 'typecheck'] },
  { name: 'audit:hardcodes', cmd: 'bun', args: ['run', 'audit:hardcodes'] },
  { name: 'preflight', cmd: 'bun', args: ['run', 'preflight'] },
  { name: 'repro (fresh-clone smoke)', cmd: 'bun', args: ['run', 'repro'] },
  // The two below talk to the sandbox MCP and (for evidence) call evaluator
  // tools. They cost a few cents and a few seconds each — fine for a
  // pre-submission run, skipped in --cheap mode.
  { name: 'evidence (sandbox 4-dim score)', cmd: 'bun', args: ['run', 'evidence'], costsMoney: true },
]

const cheap = process.argv.includes('--cheap')
const steps = cheap ? STEPS.filter((s) => !s.costsMoney) : STEPS

console.log('═════════ smoke:full ═════════')
console.log(`mode: ${cheap ? 'cheap (no sandbox calls)' : 'full (typecheck + audit + preflight + repro + evidence)'}`)
console.log(`running ${steps.length} step(s)\n`)

let pass = 0
let fail = 0

for (const [i, step] of steps.entries()) {
  const t0 = Date.now()
  process.stdout.write(`${i + 1}. ${step.name}… `)
  const r = spawnSync(step.cmd, step.args, { stdio: 'pipe', encoding: 'utf8' })
  const dur = Date.now() - t0
  if (r.status === 0) {
    pass++
    console.log(`✓ (${dur}ms)`)
  } else {
    fail++
    console.log(`✗ (${dur}ms)`)
    if (r.stderr) console.log(`   stderr: ${r.stderr.split('\n').slice(0, 5).join('\n   ')}`)
    if (r.stdout) console.log(`   stdout: ${r.stdout.split('\n').slice(-5).join('\n   ')}`)
  }
}

console.log(`\n${pass} pass · ${fail} fail`)
if (fail === 0) {
  console.log('\n✓ Repository is submission-ready.')
}
process.exit(fail === 0 ? 0 : 1)
