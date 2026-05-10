// Same-origin proxy for campaign pause/resume/adjust.
import { NextResponse } from 'next/server'

const BACKEND =
  process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3000'
const SECRET = process.env.WEB_BACKEND_SECRET

const VALID = new Set(['pause', 'resume', 'adjust'])

export async function POST(req: Request, ctx: { params: Promise<{ id: string; action: string }> }) {
  const { id, action } = await ctx.params
  if (!VALID.has(action)) {
    return NextResponse.json({ ok: false, error: 'bad_action' }, { status: 400 })
  }
  let body: unknown = {}
  try { body = await req.json() } catch {}
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (SECRET) headers['X-Backend-Secret'] = SECRET
  const upstream = await fetch(
    `${BACKEND}/api/admin/campaigns/${encodeURIComponent(id)}/${action}`,
    { method: 'POST', headers, body: JSON.stringify(body) },
  )
  const data = await upstream.json().catch(() => ({}))
  return NextResponse.json(data, { status: upstream.status })
}
