// Headless agent runtime — spawns `claude -p` per event.
//
// The hackathon hard-rule:
//   "Agents must run on Claude Code CLI with Opus 4.7. Submissions that route
//    through Claude Agent SDK ... are disqualified."
//
// So this wrapper IS the agent runtime. It builds a per-role prompt, attaches
// MCP servers (sandbox + local stdio), invokes `claude -p`, and returns the
// reply text + tool-call trace.
//
// Each role has its own system prompt + tool allowlist (see prompts/<role>.md).

import { spawn } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { config } from '../config.ts'
import { getDb } from '../db/db.ts'
import type { AgentRole, IncomingMessage } from '../channels/types.ts'
import { loadHistory, saveHistory, trimHistory, type HistoryEntry } from '../db/threads.ts'
import { ROLE_TOOL_ALLOWLIST, DENY_ALWAYS } from './allowlists.ts'

export interface AgentResult {
  reply: string
  tool_calls: Array<{ name: string; input?: unknown }>
  duration_ms: number
  cost_usd: number | null
  exit_code: number
  error?: string
}

// Streaming events extracted from `claude -p --output-format stream-json` as
// each subprocess stdout line lands. The wrapper emits these in real time so
// callers (e.g. the TG owner cockpit) can edit a placeholder message live —
// "Streaming Text for Bots" UX, but using the existing editMessageText API.
//
// stream-json grain: one event per assistant turn or tool round-trip, NOT
// per-token. We get a complete `assistant` message after each LLM step, plus
// `user` messages with `tool_result` blocks after each tool call. Final event
// is `{type:'result',...}`. So "streaming" here is step-granular, not
// character-granular — but it lines up with TG's edit cadence anyway.
export type StreamEvent =
  | { kind: 'text'; chunk: string; running: string }
  | { kind: 'tool_start'; name: string }
  | { kind: 'tool_end'; name: string }
  | { kind: 'done'; final: string }

interface InvokeOptions {
  role: AgentRole
  msg: IncomingMessage
  // MCP config file path. If unset, we use the repo's .claude/mcp.json (auto-discovered).
  mcpConfigPath?: string
  // Hard cap on subprocess wall time (ms). Default 90s.
  timeoutMs?: number
  // Optional streaming hook. Fired for each assistant text block and tool
  // call as they arrive on stdout. Errors thrown in the callback are swallowed.
  onStream?: (event: StreamEvent) => void
}

// Customer-facing roles get the HappyCake brand book v1.0 prepended to their
// system prompt. Internal roles (kitchen tickets, owner reports) skip it —
// brand voice doesn't apply to operator surfaces.
const BRAND_ROLES: AgentRole[] = ['concierge', 'marketing']

function loadPrompt(role: AgentRole): string {
  const path = resolve(`src/agent/prompts/${role}.md`)
  const role_md = existsSync(path)
    ? readFileSync(path, 'utf8')
    : `You are the HappyCake US ${role} agent. Be helpful, concise, brand-voiced.`
  if (!BRAND_ROLES.includes(role)) return role_md
  const brandPath = resolve('src/agent/prompts/brand.md')
  if (!existsSync(brandPath)) return role_md
  const brand_md = readFileSync(brandPath, 'utf8')
  return `${brand_md}\n\n---\n\n${role_md}`
}

// Surface the current local time + open/closed state so the agent stops
// guessing whether we're open. Without this, asks like "is the kitchen
// open right now?" got answered against a static brand-rules schedule
// with no idea what time it actually is — usually wrong, often "the
// kitchen is closed" when we're actually open.
function buildClockTag(): string {
  const now = new Date()
  const human = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(now)
  // Open/closed math against BRAND.openingHoursSpec; hard-coded here to
  // avoid pulling the web/lib package over to backend code.
  const cstParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(now)
  const weekday = cstParts.find((p) => p.type === 'weekday')?.value ?? 'Mon'
  const hour = parseInt(cstParts.find((p) => p.type === 'hour')?.value ?? '0', 10)
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday)
  let openness: string
  if (day === 1) openness = 'closed today (Mondays). Opens Tuesday 11 AM.'
  else if (day === 0)
    openness =
      hour < 12
        ? 'closed (Sunday opens at noon).'
        : hour < 18
          ? 'OPEN now (Sun 12-6).'
          : 'closed for the day.'
  else if (hour < 11) openness = `closed (opens at 11 AM).`
  else if (hour < 19) openness = `OPEN now (Tue-Sat 11-7).`
  else openness = `closed for the day (opens tomorrow 11 AM).`
  return `<current_time>America/Chicago: ${human}. Shop is ${openness}</current_time>`
}

function buildPrompt(msg: IncomingMessage, history: HistoryEntry[]): string {
  const transcript = history.map((h) => `[${h.role}] ${h.content}`).join('\n')
  return [
    transcript ? `<conversation_history>\n${transcript}\n</conversation_history>` : '',
    buildClockTag(),
    `<thread_meta>channel=${msg.channel} thread_id=${msg.threadId} sender=${msg.senderName ?? msg.senderId}</thread_meta>`,
    `<customer_message>\n${msg.text}\n</customer_message>`,
    'Reply to the customer. Use tools as needed. Do NOT include the tags above in your reply.',
  ]
    .filter(Boolean)
    .join('\n\n')
}

function logInvocation(row: {
  id: string
  role: AgentRole
  thread_id: string
  prompt_chars: number
  response_chars: number
  duration_ms: number
  cost_usd: number | null
  exit_code: number
  error?: string
}) {
  try {
    getDb()
      .prepare(
        `INSERT INTO agent_invocations
         (id, role, thread_id, prompt_chars, response_chars, duration_ms, cost_usd, exit_code, error, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        row.id,
        row.role,
        row.thread_id,
        row.prompt_chars,
        row.response_chars,
        row.duration_ms,
        row.cost_usd,
        row.exit_code,
        row.error ?? null,
        Date.now(),
      )
  } catch (err) {
    console.error('[agent] invocation log failed:', (err as Error).message)
  }
}

export async function invokeAgent(opts: InvokeOptions): Promise<AgentResult> {
  const { role, msg } = opts
  const timeoutMs = opts.timeoutMs ?? 90_000

  const history = trimHistory(loadHistory(msg.threadId))
  const userPrompt = buildPrompt(msg, history)
  const systemPrompt = loadPrompt(role)
  const allowedTools = ROLE_TOOL_ALLOWLIST[role]

  const args: string[] = [
    '-p',
    userPrompt,
    '--model',
    config.agent.model,
    '--output-format',
    'stream-json',
    '--verbose',
    '--append-system-prompt',
    systemPrompt,
    '--allowedTools',
    allowedTools.join(' '),
    '--disallowedTools',
    DENY_ALWAYS.join(' '),
    '--max-budget-usd',
    String(config.agent.maxBudgetUsd),
    '--dangerously-skip-permissions',
    '--no-session-persistence',
  ]
  if (opts.mcpConfigPath) {
    args.push('--mcp-config', opts.mcpConfigPath)
  }

  const start = Date.now()
  const id = `inv_${start}_${Math.random().toString(36).slice(2, 8)}`

  const result = await new Promise<AgentResult>((resolveOuter) => {
    const child = spawn(config.agent.bin, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        // Inject sandbox MCP token only at subprocess level; never log.
        SBC_TEAM_TOKEN: config.sandbox.teamToken ?? '',
        SBC_MCP_URL: config.sandbox.mcpUrl,
      },
    })

    // Line-buffered stdout so we can parse + emit stream events as events
    // arrive, not at process close.
    let stdoutBuf = ''
    let stderr = ''
    let reply = ''
    let runningText = ''
    let cost_usd: number | null = null
    const tool_calls: AgentResult['tool_calls'] = []

    const safeStream = (event: StreamEvent) => {
      if (!opts.onStream) return
      try {
        opts.onStream(event)
      } catch (err) {
        console.error('[agent] onStream callback err:', (err as Error).message)
      }
    }

    interface StreamJsonEvent {
      type?: string
      message?: { content?: Array<{ type: string; name?: string; input?: unknown; text?: string }> }
      result?: string
      total_cost_usd?: number
    }

    const handleEvent = (evt: StreamJsonEvent) => {
      if (evt.type === 'result') {
        reply = evt.result ?? reply
        if (typeof evt.total_cost_usd === 'number') cost_usd = evt.total_cost_usd
        safeStream({ kind: 'done', final: reply })
        return
      }
      if (evt.type === 'assistant' && evt.message?.content) {
        for (const block of evt.message.content) {
          if (block.type === 'text' && typeof block.text === 'string' && block.text.length > 0) {
            runningText = runningText ? `${runningText}\n\n${block.text}` : block.text
            safeStream({ kind: 'text', chunk: block.text, running: runningText })
          } else if (block.type === 'tool_use' && block.name && block.name !== 'ToolSearch') {
            tool_calls.push({ name: block.name, input: block.input })
            safeStream({ kind: 'tool_start', name: block.name })
          }
        }
        return
      }
      if (evt.type === 'user' && evt.message?.content) {
        for (const block of evt.message.content) {
          // tool_result blocks confirm a tool call returned. Use the most recent
          // tool_use name so the UI can show "✓ kitchen_get_capacity → ...".
          const lastTool = tool_calls[tool_calls.length - 1]
          if (block.type === 'tool_result' && lastTool) {
            safeStream({ kind: 'tool_end', name: lastTool.name })
          }
        }
      }
    }

    const flushLines = () => {
      let nl = stdoutBuf.indexOf('\n')
      while (nl !== -1) {
        const line = stdoutBuf.slice(0, nl).trim()
        stdoutBuf = stdoutBuf.slice(nl + 1)
        if (line) {
          try {
            handleEvent(JSON.parse(line) as StreamJsonEvent)
          } catch {
            // not a complete JSON object — skip
          }
        }
        nl = stdoutBuf.indexOf('\n')
      }
    }

    const timer = setTimeout(() => {
      child.kill('SIGTERM')
    }, timeoutMs)

    child.stdout.on('data', (chunk) => {
      stdoutBuf += chunk.toString()
      flushLines()
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      // Drain any partial buffer (e.g. last line without trailing newline).
      if (stdoutBuf.trim()) {
        try {
          handleEvent(JSON.parse(stdoutBuf.trim()) as StreamJsonEvent)
        } catch {
          /* ignore */
        }
      }
      const duration_ms = Date.now() - start
      const out: AgentResult = {
        reply,
        tool_calls,
        duration_ms,
        cost_usd,
        exit_code: code ?? -1,
        error: code === 0 ? undefined : stderr.slice(0, 1000) || `exit ${code}`,
      }
      logInvocation({
        id,
        role,
        thread_id: msg.threadId,
        prompt_chars: userPrompt.length,
        response_chars: reply.length,
        duration_ms,
        cost_usd,
        exit_code: code ?? -1,
        error: out.error,
      })
      resolveOuter(out)
    })
  })

  if (result.exit_code === 0 && result.reply) {
    const newHistory: HistoryEntry[] = [
      ...history,
      { role: 'user', content: msg.text, ts: msg.timestamp },
      { role: 'assistant', content: result.reply, ts: Date.now() },
    ]
    saveHistory(msg.threadId, msg.channel, newHistory, msg.senderName, msg.senderId)
  }

  return result
}

// Keyed by threadId so /test/incoming can return the last tool-call trace
// for evaluator inspection without rerunning the agent.
const lastRun = new Map<string, AgentResult>()
export function recordRun(threadId: string, run: AgentResult) {
  lastRun.set(threadId, run)
}
export function getLastRun(threadId: string): AgentResult | undefined {
  return lastRun.get(threadId)
}
