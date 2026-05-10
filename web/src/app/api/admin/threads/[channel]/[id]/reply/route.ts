// Same-origin proxy for owner replies. The browser POSTs here (no CORS),
// we forward to the Hono backend with the WEB_BACKEND_SECRET header so
// SSR-style auth keeps working. Keeps the inbox UI hosted under Next while
// the channel adapters live in the backend.

import { NextResponse } from 'next/server'

const BACKEND =
  process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3000'
const SECRET = process.env.WEB_BACKEND_SECRET

const VALID = new Set(['whatsapp', 'instagram', 'web'])

export async function POST(
  req: Request,
  ctx: { params: Promise<{ channel: string; id: string }> },
) {
  const { channel, id } = await ctx.params
  if (!VALID.has(channel)) {
    return NextResponse.json({ ok: false, error: 'bad_channel' }, { status: 400 })
  }
  let body: unknown = {}
  try { body = await req.json() } catch {}
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (SECRET) headers['X-Backend-Secret'] = SECRET
  const upstream = await fetch(
    `${BACKEND}/api/admin/threads/${channel}/${encodeURIComponent(id)}/reply`,
    { method: 'POST', headers, body: JSON.stringify(body) },
  )
  const data = await upstream.json().catch(() => ({}))
  return NextResponse.json(data, { status: upstream.status })
}
