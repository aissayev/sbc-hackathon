// Same-origin proxy for owner approval decisions.
import { NextResponse } from 'next/server'

const BACKEND =
  process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3000'
const SECRET = process.env.WEB_BACKEND_SECRET

export async function POST(req: Request, ctx: { params: Promise<{ id: string; decision: string }> }) {
  const { id, decision } = await ctx.params
  if (decision !== 'approve' && decision !== 'reject') {
    return NextResponse.json({ ok: false, error: 'bad_decision' }, { status: 400 })
  }
  let body: unknown = {}
  try { body = await req.json() } catch {}
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (SECRET) headers['X-Backend-Secret'] = SECRET
  const upstream = await fetch(
    `${BACKEND}/api/admin/approvals/${encodeURIComponent(id)}/${decision}`,
    { method: 'POST', headers, body: JSON.stringify(body) },
  )
  const data = await upstream.json().catch(() => ({}))
  return NextResponse.json(data, { status: upstream.status })
}
