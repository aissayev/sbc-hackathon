// Same-origin proxy helper for /api/admin/* Next routes.
//
// All admin proxies have the same shape: forward a POST/GET to the Hono
// backend with the WEB_BACKEND_SECRET header, return whatever JSON came
// back. The pieces that differ (path, body) are passed in.
//
// Failure modes we explicitly handle, so the cockpit never sees a Next
// 500 with no useful message:
//   - backend down / unreachable (ECONNREFUSED, DNS, etc.) → 503 with
//     a clear "backend unreachable" payload
//   - request timeout (default 8s) → 504
//   - upstream returns non-JSON → still surface its status, log the body
//
// The cockpit UIs that consume this (ChannelActions, ApprovalActions,
// ReplyForm, CampaignActions) all already render { ok: false, error: ... }
// payloads, so the contract is uniform.

import { NextResponse } from 'next/server'

const BACKEND =
  process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3000'
const SECRET = process.env.WEB_BACKEND_SECRET
const DEFAULT_TIMEOUT_MS = 8_000

interface ForwardOpts {
  method?: 'GET' | 'POST'
  body?: unknown
  timeoutMs?: number
}

export async function forwardToBackend(path: string, opts: ForwardOpts = {}): Promise<NextResponse> {
  const method = opts.method ?? 'POST'
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (SECRET) headers['X-Backend-Secret'] = SECRET

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS)

  try {
    const upstream = await fetch(`${BACKEND}${path}`, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    })
    const text = await upstream.text()
    let data: unknown
    try {
      data = text ? JSON.parse(text) : {}
    } catch {
      // Backend returned non-JSON (e.g. HTML 500 page from Hono). Surface
      // status + a snippet so the user knows it wasn't us.
      return NextResponse.json(
        { ok: false, error: `upstream non-JSON response (${upstream.status})`, snippet: text.slice(0, 200) },
        { status: upstream.status || 502 },
      )
    }
    return NextResponse.json(data, { status: upstream.status })
  } catch (err) {
    const message = (err as Error).message ?? String(err)
    const isAbort = (err as Error).name === 'AbortError'
    return NextResponse.json(
      {
        ok: false,
        error: isAbort
          ? `Backend timed out after ${(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS) / 1000}s`
          : `Backend unreachable: ${message}`,
      },
      { status: isAbort ? 504 : 503 },
    )
  } finally {
    clearTimeout(timeout)
  }
}

export async function readJsonBody(req: Request): Promise<unknown> {
  try { return await req.json() } catch { return {} }
}
