// Same-origin proxy for owner replies.
import { NextResponse } from 'next/server'
import { forwardToBackend, readJsonBody } from '@/lib/admin-proxy'

const VALID = new Set(['whatsapp', 'instagram', 'web'])

export async function POST(req: Request, ctx: { params: Promise<{ channel: string; id: string }> }) {
  const { channel, id } = await ctx.params
  if (!VALID.has(channel)) {
    return NextResponse.json({ ok: false, error: 'bad_channel' }, { status: 400 })
  }
  const body = await readJsonBody(req)
  return forwardToBackend(
    `/api/admin/threads/${channel}/${encodeURIComponent(id)}/reply`,
    { body },
  )
}
