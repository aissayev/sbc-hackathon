// Direct HTTP JSON-RPC client to the sandbox MCP at steppebusinessclub.com.
//
// Why we have this — the agent (`claude -p`) calls sandbox tools natively via
// MCP, but we also need to call them from orchestration code where spawning a
// subprocess is overkill or undesirable:
//
//   - Dual-path channel adapter (`whatsapp_send`, `instagram_send_dm`) so
//     evaluator scoring sees our replies without going through claude -p again
//   - Owner approve/reject flow (`square_create_order`, `kitchen_create_ticket`)
//     where determinism + speed matter more than reasoning
//   - The hypothesis script (`marketing_get_sales_history`,
//     `marketing_get_margin_by_product`) which needs raw data, not narration
//   - Pre-submit evidence harness (`evaluator_*`) called from CI scripts
//
// This is a thin transport, not a framework. ~80 lines, no dependencies.

import { config } from '../config.ts'

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: string
  method: string
  params: { name: string; arguments: Record<string, unknown> }
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: string
  result?: {
    content: Array<{ type: 'text'; text: string }>
    isError?: boolean
  }
  error?: { code: number; message: string; data?: unknown }
}

export class SandboxMcpError extends Error {
  constructor(
    public toolName: string,
    public code: number,
    message: string,
    public data?: unknown,
  ) {
    super(`sandbox.${toolName}: ${message}`)
    this.name = 'SandboxMcpError'
  }
}

let nextId = 1
function rpcId() {
  return `rpc_${Date.now()}_${nextId++}`
}

/**
 * Call a sandbox MCP tool directly via HTTP JSON-RPC.
 * The tool name is the BARE name from the sandbox (e.g. `square_list_catalog`),
 * NOT the prefixed `mcp__happycake__*` name the agent sees.
 *
 * @example
 *   const catalog = await callSandboxTool<{}, { items: any[] }>('square_list_catalog', {})
 *   await callSandboxTool('whatsapp_send', { to: '+12815551001', message: 'Hi!' })
 */
export async function callSandboxTool<TResult = unknown>(
  toolName: string,
  args: Record<string, unknown> = {},
): Promise<TResult> {
  const url = config.sandbox.mcpUrl
  const token = config.sandbox.teamToken
  if (!token) {
    throw new SandboxMcpError(toolName, -32000, 'SBC_TEAM_TOKEN not set in .env.local')
  }

  const req: JsonRpcRequest = {
    jsonrpc: '2.0',
    id: rpcId(),
    method: 'tools/call',
    params: { name: toolName, arguments: args },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Team-Token': token,
    },
    body: JSON.stringify(req),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '<unreadable>')
    throw new SandboxMcpError(toolName, res.status, `HTTP ${res.status}`, text.slice(0, 500))
  }

  const body = (await res.json()) as JsonRpcResponse
  if (body.error) {
    throw new SandboxMcpError(toolName, body.error.code, body.error.message, body.error.data)
  }

  const result = body.result
  if (!result) {
    throw new SandboxMcpError(toolName, -32603, 'no result in response')
  }
  if (result.isError) {
    const text = result.content?.[0]?.text ?? 'tool reported error'
    throw new SandboxMcpError(toolName, -32000, text)
  }

  // MCP tool results are wrapped: result.content[0].text is the JSON string.
  // Parse it for callers that expect typed data.
  const textBlock = result.content?.[0]?.text
  if (typeof textBlock !== 'string') {
    throw new SandboxMcpError(toolName, -32603, 'unexpected result shape (no text content)')
  }
  try {
    return JSON.parse(textBlock) as TResult
  } catch {
    // Some tools return plain text (not JSON) — return the string as-is.
    return textBlock as unknown as TResult
  }
}

/**
 * Try a sandbox tool call; return null on error instead of throwing.
 * Useful for best-effort outbound (e.g. dual-path adapter where one
 * channel may legitimately fail without breaking the other).
 */
export async function tryCallSandboxTool<TResult = unknown>(
  toolName: string,
  args: Record<string, unknown> = {},
): Promise<TResult | null> {
  try {
    return await callSandboxTool<TResult>(toolName, args)
  } catch (err) {
    console.warn(`[sandbox-mcp] ${toolName} failed:`, (err as Error).message)
    return null
  }
}
