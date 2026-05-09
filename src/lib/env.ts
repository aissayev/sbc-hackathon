// Env loader. Bun auto-loads .env.local but shell wins on conflicts.
// We re-read .env.local manually to recover when the shell exports an empty value
// (macOS Claude for Desktop is a known offender for ANTHROPIC_API_KEY="").

import { existsSync, readFileSync } from 'node:fs'

const fileEnv: Record<string, string> = (() => {
  if (!existsSync('.env.local')) return {}
  const out: Record<string, string> = {}
  for (const raw of readFileSync('.env.local', 'utf8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    const k = line.slice(0, i).trim()
    let v = line.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    if (k && v) out[k] = v
  }
  return out
})()

export function envGet(key: string): string | undefined {
  const shell = process.env[key]
  if (shell && shell.length > 0) return shell
  return fileEnv[key]
}

export function envRequire(key: string): string {
  const v = envGet(key)
  if (!v) throw new Error(`Missing env var: ${key}`)
  return v
}

export function envBool(key: string, defaultValue = false): boolean {
  const v = envGet(key)
  if (!v) return defaultValue
  return v === 'true' || v === '1' || v === 'yes'
}
