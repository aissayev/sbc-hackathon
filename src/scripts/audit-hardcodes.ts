// Hardcode-grep audit. Failsafe against the brief's -10 penalty:
//   "Hardcoded test answers cost 10 pts and a public note."
//
// What we look for in src/:
//   - Scenario IDs from world (e.g. evt_001) — agent replies should never key off these
//   - Specific simulated phone numbers in conditionals (must be data-driven)
//   - "if (text.includes('honey cake'))" style scenario-specific branches
//   - Branching on world scenario ids
//
// Run: bun run audit:hardcodes
// Exits non-zero if any flagged pattern is found.

import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

interface Finding {
  file: string
  line: number
  match: string
  rule: string
}

const findings: Finding[] = []
const allowList = new Set([
  // Test/eval/audit scripts can mention specific values legitimately
  'src/scripts/audit-hardcodes.ts',
  'src/scripts/test-orchestration.ts',
  'src/scripts/test-sandbox-mcp.ts',
  'src/scripts/close-eval-gaps.ts',
  'src/scripts/boost-coverage.ts',
  'src/scripts/marketing-run.ts',
  'src/scripts/world-run.ts',
  'src/scripts/world-start.ts',
  'src/scripts/evidence.ts',
  'src/scripts/smoke-agent.ts',
  'src/scripts/agent-cli.ts',
  'src/scripts/register-webhooks.ts',
  'src/scripts/webhooks-status.ts',
  'src/scripts/db-init.ts',
  'src/scripts/setup-mcp.ts',
  'src/scripts/close-channels.ts',
  'src/scripts/owner-bot.ts',
  // Domain bridge mappings between SKU and Square variation IDs are deliberate
  'src/domain/order-orchestration.ts',
  // Catalog seed is the source of truth, not a hardcode
  'data/catalog/happycake.seed.json',
])

function checkFile(file: string) {
  if (allowList.has(file)) return
  const text = readFileSync(file, 'utf8')
  text.split('\n').forEach((line, i) => {
    const lineNum = i + 1
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return
    if (/\bevt_\d{3,}\b/.test(line)) {
      findings.push({ file, line: lineNum, match: line.slice(0, 100), rule: 'scenario_event_id' })
    }
    if (/\+1281555\d{4}/.test(line)) {
      findings.push({ file, line: lineNum, match: line.slice(0, 100), rule: 'simulated_phone' })
    }
    if (/if\s*\(.*\b(launch-day-revenue-engine|weekend-capacity-crunch)\b/.test(line)) {
      findings.push({ file, line: lineNum, match: line.slice(0, 100), rule: 'scenario_branching' })
    }
    if (/\.(includes|startsWith|endsWith)\(['"](?:custom birthday cake for|chocolate cake for tomorrow|honey cake today)['"]\)/.test(line)) {
      findings.push({ file, line: lineNum, match: line.slice(0, 100), rule: 'message_pattern_match' })
    }
  })
}

const filesOutput = execSync('git ls-files src 2>/dev/null', { encoding: 'utf8' })
const files = filesOutput.split('\n').filter((f) => f && (f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js')))

for (const f of files) {
  try {
    checkFile(f)
  } catch (e) {
    console.warn(`(skipping ${f}: ${(e as Error).message})`)
  }
}

if (findings.length === 0) {
  console.log(`✓ No hardcode-grep findings across ${files.length} files`)
  console.log('  Rules checked: scenario_event_id, simulated_phone, scenario_branching, message_pattern_match')
  process.exit(0)
}

console.log(`✗ ${findings.length} potential hardcode finding(s):\n`)
for (const f of findings) {
  console.log(`  ${f.file}:${f.line}  [${f.rule}]`)
  console.log(`    ${f.match.trim()}`)
}
console.log('\n  These match patterns that the eval may flag as hardcoded test answers (-10 penalty).')
console.log('  Review each. Refactor to data-driven if appropriate.')
process.exit(1)
