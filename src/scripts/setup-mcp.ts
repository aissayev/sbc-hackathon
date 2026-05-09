// Render .mcp.json.template -> .mcp.json with env substitution.
// .mcp.json is gitignored. Run after editing .env.local.
//
// Usage: bun run setup:mcp

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { config } from '../config.ts'

const templatePath = resolve('.mcp.json.template')
const targetPath = resolve('.mcp.json')

if (!existsSync(templatePath)) {
  console.error('missing .mcp.json.template at repo root')
  process.exit(1)
}

if (!config.sandbox.teamToken) {
  console.error('SBC_TEAM_TOKEN is not set in .env.local')
  console.error('Add SBC_TEAM_TOKEN=sbc_team_... to .env.local then re-run.')
  process.exit(1)
}

const template = readFileSync(templatePath, 'utf8')
const rendered = template
  .replace(/\$\{SBC_MCP_URL\}/g, config.sandbox.mcpUrl)
  .replace(/\$\{SBC_TEAM_TOKEN\}/g, config.sandbox.teamToken)

// Drop the _doc line so Claude Code doesn't complain about extra fields.
const parsed = JSON.parse(rendered) as { _doc?: string; mcpServers: Record<string, unknown> }
delete parsed._doc
writeFileSync(targetPath, JSON.stringify(parsed, null, 2) + '\n')

console.log(`✓ wrote ${targetPath}`)
console.log(`  - happycake (http): ${config.sandbox.mcpUrl}`)
console.log(`  - local (stdio): src/agent/mcp/local-server.ts`)
console.log(`  Token prefix in header: ${config.sandbox.teamToken.slice(0, 12)}...`)
