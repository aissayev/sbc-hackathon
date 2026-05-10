// Single-application detail. Pitch, contact links, status pills, notes
// editor. Notes + status flow through PATCH /api/admin/applications/:id.

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAdminApplication, type AdminApplicationStatus } from '@/lib/api'
import { CAREERS_ROLE_LABEL } from '@/lib/careers'
import { fmtRelativeDate } from '@/lib/format'
import { ApplicationEditor } from './editor'

export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

const STATUS_TONE: Record<AdminApplicationStatus, string> = {
  new: 'bg-sky/10 text-sky-700',
  reviewing: 'bg-amber-100 text-amber-800',
  interview: 'bg-indigo-100 text-indigo-700',
  hired: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-cocoa-700/10 text-cocoa-900/70',
}

export default async function AdminApplicationDetailPage(props: { params: Params }) {
  const { id } = await props.params
  const app = await getAdminApplication(id)
  if (!app) notFound()

  const meta = parseMeta(app.meta_json)
  const roleLabel = CAREERS_ROLE_LABEL[app.role]
  const tone = STATUS_TONE[app.status]

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <Link href="/admin/careers" className="text-sm text-cocoa-700 hover:underline">
          ← All applications
        </Link>
        <h2 className="display-h2 mt-2 break-words">{app.name}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.1em] ${tone}`}>
            {app.status}
          </span>
          <span className="text-cocoa-900/70">{roleLabel}</span>
          {app.role === 'other' && app.role_hint && (
            <span className="text-cocoa-900/55 italic">— {app.role_hint}</span>
          )}
          <span aria-hidden className="text-cocoa-900/30">·</span>
          <span className="text-cocoa-900/70">
            received {fmtRelativeDate(new Date(app.created_at).toISOString())}
          </span>
        </div>

        <section className="mt-8">
          <p className="eyebrow">Pitch</p>
          <p className="mt-2 whitespace-pre-line text-cocoa-900 leading-relaxed">{app.pitch}</p>
        </section>

        {app.portfolio_url && (
          <section className="mt-6">
            <p className="eyebrow">Portfolio / link</p>
            <a
              href={app.portfolio_url}
              target="_blank"
              rel="noopener"
              className="mt-2 inline-block text-sky-700 hover:text-sky-900 break-all"
            >
              {app.portfolio_url}
            </a>
          </section>
        )}

        {(meta.heard_from || meta.availability) && (
          <section className="mt-6 grid sm:grid-cols-2 gap-4">
            {meta.availability && (
              <div className="rounded-md border border-cocoa-700/15 bg-cream-50 p-4">
                <p className="eyebrow">Availability</p>
                <p className="mt-1 text-sm">{meta.availability}</p>
              </div>
            )}
            {meta.heard_from && (
              <div className="rounded-md border border-cocoa-700/15 bg-cream-50 p-4">
                <p className="eyebrow">Heard from</p>
                <p className="mt-1 text-sm">{meta.heard_from}</p>
              </div>
            )}
          </section>
        )}
      </div>

      <aside className="space-y-4">
        <div className="rounded-md border border-cocoa-700/15 bg-cream-50 p-5">
          <p className="eyebrow">Contact</p>
          <p className="mt-2 break-all">
            <a href={`mailto:${app.email}`} className="text-cocoa-900 hover:text-sky-700">
              {app.email}
            </a>
          </p>
          {app.phone && (
            <p className="mt-1 break-all">
              <a href={`tel:${app.phone}`} className="text-cocoa-900 hover:text-sky-700 font-mono">
                {app.phone}
              </a>
            </p>
          )}
        </div>
        <ApplicationEditor
          applicationId={app.id}
          initialStatus={app.status}
          initialNotes={app.notes ?? ''}
        />
      </aside>
    </div>
  )
}

function parseMeta(json: string | null): { heard_from?: string; availability?: string } {
  if (!json) return {}
  try {
    const parsed = JSON.parse(json) as { heard_from?: unknown; availability?: unknown }
    return {
      heard_from: typeof parsed.heard_from === 'string' ? parsed.heard_from : undefined,
      availability: typeof parsed.availability === 'string' ? parsed.availability : undefined,
    }
  } catch {
    return {}
  }
}
