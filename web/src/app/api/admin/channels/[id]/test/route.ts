// Same-origin proxy: inject a test inbound event for the given channel.
import { forwardToBackend } from '@/lib/admin-proxy'

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return forwardToBackend(`/api/admin/channels/${id}/test`)
}
