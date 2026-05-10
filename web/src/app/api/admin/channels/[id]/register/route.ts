// Same-origin proxy: register a sandbox webhook for the given channel.
import { NextResponse } from 'next/server'

const BACKEND =
  process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3000'
const SECRET = process.env.WEB_BACKEND_SECRET

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (SECRET) headers['X-Backend-Secret'] = SECRET
  const upstream = await fetch(`${BACKEND}/api/admin/channels/${id}/register`, {
    method: 'POST', headers,
  })
  const data = await upstream.json().catch(() => ({}))
  return NextResponse.json(data, { status: upstream.status })
}
