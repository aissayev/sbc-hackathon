// Same-origin proxy for owner approval decisions.
import { NextResponse } from 'next/server'
import { forwardToBackend, readJsonBody } from '@/lib/admin-proxy'

export async function POST(req: Request, ctx: { params: Promise<{ id: string; decision: string }> }) {
  const { id, decision } = await ctx.params
  if (decision !== 'approve' && decision !== 'reject') {
    return NextResponse.json({ ok: false, error: 'bad_decision' }, { status: 400 })
  }
  const body = await readJsonBody(req)
  return forwardToBackend(
    `/api/admin/approvals/${encodeURIComponent(id)}/${decision}`,
    { body },
  )
}
