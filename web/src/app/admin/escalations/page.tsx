import { listEscalations } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { fmtRelativeDate, formatOrderId } from '@/lib/format'

export const dynamic = 'force-dynamic'

const SEVERITY: Record<string, 'default' | 'sage' | 'blue' | 'coral'> = {
  low: 'default',
  medium: 'blue',
  high: 'coral',
}

export default async function AdminEscalationsPage() {
  const items = await listEscalations()
  const open = items.filter((i) => i.status === 'open')

  return (
    <div>
      <div className="flex items-center gap-3">
        <h2 className="display-h3">Open escalations</h2>
        {open.length > 0 && <Badge variant="coral">{open.length}</Badge>}
      </div>

      {open.length === 0 ? (
        <div className="mt-3 rounded-md bg-cream-100 p-6 text-sm text-cocoa-900/70">
          Nothing open. Quiet day on the support side.
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-cocoa-700/10 rounded-md border border-cocoa-700/15 bg-white">
          {open.map((e) => (
            <li key={e.id} className="p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <span className="font-medium text-cocoa-900 font-mono text-xs" title={e.id}>{formatOrderId(e.id, 'short')}</span>
                  <span className="ml-3 text-sm text-cocoa-900/70">{e.channel}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-cocoa-900/60">
                  <Badge variant={SEVERITY[e.severity] ?? 'default'}>{e.severity}</Badge>
                  <span>{fmtRelativeDate(e.created_at)}</span>
                </div>
              </div>
              <p className="mt-2 text-sm text-cocoa-900">{e.reason}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
