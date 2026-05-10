// Same-origin proxy for campaign pause/resume/adjust.
import { NextResponse } from 'next/server'
import { forwardToBackend, readJsonBody } from '@/lib/admin-proxy'

const VALID = new Set(['pause', 'resume', 'adjust'])

export async function POST(req: Request, ctx: { params: Promise<{ id: string; action: string }> }) {
  const { id, action } = await ctx.params
  if (!VALID.has(action)) {
    return NextResponse.json({ ok: false, error: 'bad_action' }, { status: 400 })
  }
  const body = await readJsonBody(req)
  return forwardToBackend(
    `/api/admin/campaigns/${encodeURIComponent(id)}/${action}`,
    { body },
  )
}
