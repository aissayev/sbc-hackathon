// Admin careers cockpit. The owner's hiring pipeline:
//
//   - Top-of-page filter pills with live counts ("All · 5 New · 2 Reviewing")
//     drive a status filter; combined with a role dropdown they cut the list
//     to whatever the owner wants to focus on right now.
//   - Each row links to /admin/careers/[id] for the full pitch + status
//     dropdown + free-text notes editor.
//
// Public submissions land via /api/careers/apply (no auth) and a TG card
// pings the owner; this page mirrors the same data on the wider screen.

import Link from 'next/link'
import {
  listAdminApplications,
  type AdminApplication,
  type AdminApplicationStatus,
  type AdminApplicationRole,
} from '@/lib/api'
import { CAREERS_ROLE_LABEL } from '@/lib/careers'
import { fmtRelativeDate } from '@/lib/format'
import { Eyebrow } from '@/components/brand/eyebrow'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ status?: string; role?: string }>

const STATUS_FILTERS: Array<{ key: AdminApplicationStatus | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'reviewing', label: 'Reviewing' },
  { key: 'interview', label: 'Interview' },
  { key: 'hired', label: 'Hired' },
  { key: 'rejected', label: 'Rejected' },
]

const STATUS_TONE: Record<AdminApplicationStatus, string> = {
  new: 'bg-sky/10 text-sky-700',
  reviewing: 'bg-amber-100 text-amber-800',
  interview: 'bg-indigo-100 text-indigo-700',
  hired: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-cocoa-700/10 text-cocoa-900/70',
}

function isStatus(v: string | undefined): v is AdminApplicationStatus | 'all' {
  return v === 'all' || v === 'new' || v === 'reviewing' || v === 'interview' || v === 'hired' || v === 'rejected'
}

function isRole(v: string | undefined): v is AdminApplicationRole | 'all' {
  return v === 'all' || v === 'counter' || v === 'baker' || v === 'driver' || v === 'other'
}

export default async function AdminCareersPage(props: { searchParams?: SearchParams }) {
  const params = (await props.searchParams) ?? {}
  const status = isStatus(params.status) ? params.status : 'all'
  const role = isRole(params.role) ? params.role : 'all'
  const { applications, counts } = await listAdminApplications({ status, role, limit: 200 })

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Hiring</Eyebrow>
          <h2 className="display-h2 mt-2">Career applications</h2>
          <p className="mt-1 text-sm text-cocoa-900/70">
            {counts.total === 0
              ? 'No applications yet — they appear here when someone applies on /careers.'
              : `${counts.total} application${counts.total === 1 ? '' : 's'} · sorted by most recent.`}
          </p>
        </div>
        <RoleFilter current={role} status={status} />
      </div>

      {/* Status pills with live counts */}
      <div className="mt-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => {
          const count = f.key === 'all' ? counts.total : counts[f.key]
          const active = f.key === status
          const url = buildUrl({ status: f.key === 'all' ? undefined : f.key, role: role === 'all' ? undefined : role })
          return (
            <Link
              key={f.key}
              href={url}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-3.5 h-8 text-sm border transition-colors',
                active
                  ? 'bg-cocoa-900 text-cream border-cocoa-900'
                  : 'border-cocoa-700/15 text-cocoa-900 hover:bg-cream-100',
              )}
            >
              <span>{f.label}</span>
              <span
                className={cn(
                  'tabular-nums text-[11px] px-1.5 rounded-md',
                  active ? 'bg-white/15' : 'bg-cocoa-700/8',
                )}
              >
                {count}
              </span>
            </Link>
          )
        })}
      </div>

      {applications.length === 0 ? (
        <div className="mt-8 rounded-md bg-cream-100 border border-cocoa-700/15 p-6 text-sm text-cocoa-900/70">
          No applications match this filter.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-md border border-cocoa-700/15 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-cream-100 text-cocoa-900/65 text-left text-[11px] uppercase tracking-[0.16em]">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Phone</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cocoa-700/10">
              {applications.map((a) => (
                <ApplicationRow key={a.id} application={a} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ApplicationRow({ application }: { application: AdminApplication }) {
  const roleLabel = CAREERS_ROLE_LABEL[application.role] ?? application.role
  const tone = STATUS_TONE[application.status] ?? 'bg-cream-200 text-cocoa-700'
  return (
    <tr className="hover:bg-cream-50">
      <td className="px-4 py-3">
        <Link
          href={`/admin/careers/${application.id}`}
          className="font-medium text-cocoa-900 hover:text-sky-700"
        >
          {application.name}
        </Link>
      </td>
      <td className="px-4 py-3 text-cocoa-900/85">
        {roleLabel}
        {application.role === 'other' && application.role_hint && (
          <span className="block text-[11px] text-cocoa-900/55 italic">
            {application.role_hint}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-cocoa-900/80 truncate max-w-[200px]">{application.email}</td>
      <td className="px-4 py-3 font-mono text-cocoa-900/80 hidden md:table-cell">
        {application.phone ?? <span className="text-cocoa-900/40">—</span>}
      </td>
      <td className="px-4 py-3">
        <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.1em]', tone)}>
          {application.status}
        </span>
      </td>
      <td className="px-4 py-3 text-cocoa-900/70">
        {fmtRelativeDate(new Date(application.created_at).toISOString())}
      </td>
    </tr>
  )
}

function buildUrl(opts: { status?: string; role?: string }): string {
  const params = new URLSearchParams()
  if (opts.status) params.set('status', opts.status)
  if (opts.role) params.set('role', opts.role)
  const qs = params.toString()
  return qs ? `/admin/careers?${qs}` : '/admin/careers'
}

// Plain server-rendered <select> wrapped in a tiny <form> so the owner can
// narrow by role without pulling in client JS for one form. Submitting via
// GET preserves the URL filters; the page re-renders.
function RoleFilter({
  current,
  status,
}: {
  current: AdminApplicationRole | 'all'
  status: AdminApplicationStatus | 'all'
}) {
  const ROLES: Array<{ value: AdminApplicationRole | 'all'; label: string }> = [
    { value: 'all', label: 'All roles' },
    { value: 'counter', label: 'Counter & coffee' },
    { value: 'baker', label: 'Baker / decorator' },
    { value: 'driver', label: 'Delivery driver' },
    { value: 'other', label: 'Other / open' },
  ]
  return (
    <form action="/admin/careers" method="get" className="flex items-center gap-2">
      {/* Preserve the active status filter when changing role. */}
      {status !== 'all' && <input type="hidden" name="status" value={status} />}
      <select
        name="role"
        defaultValue={current}
        className="h-10 rounded-md border border-cocoa-700/15 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky/40"
      >
        {ROLES.map((r) => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>
      <button
        type="submit"
        className="h-10 rounded-md bg-cocoa-900 text-cream text-sm px-3 font-medium"
      >
        Filter
      </button>
    </form>
  )
}
