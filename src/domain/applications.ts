// Career applications. Submitted from /careers, surfaced in /admin/careers
// and on the owner's Telegram via postApplicationCard().
//
// Storage is the SQLite `applications` table (see src/db/schema.sql). All
// strings come from the Zod schema below; HTTP layer in src/routes/careers.ts
// is the only caller.

import { z } from 'zod'
import { getDb } from '../db/db.ts'

// Roles we publish on the careers page. Keep in sync with the FE list in
// web/src/app/careers/page.tsx and web/src/lib/careers.ts. "other" maps
// to the "Don't see your role?" path; the FE collects a free-text hint.
const APPLICATION_ROLES = ['counter', 'baker', 'driver', 'other'] as const
export type ApplicationRole = (typeof APPLICATION_ROLES)[number]

// Status machine. `new` → owner reviewing → outreach → terminal. Same
// vocabulary used by the admin UI dropdown.
const APPLICATION_STATUSES = ['new', 'reviewing', 'interview', 'hired', 'rejected'] as const
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

export const createApplicationSchema = z.object({
  role: z.enum(APPLICATION_ROLES),
  // Required only when role='other' — the free-text "what would you like to
  // do" hint. Capped at 80 to keep the TG card readable.
  role_hint: z.string().trim().max(80).optional(),
  name: z.string().trim().min(2, 'Your name').max(80),
  email: z.string().trim().email('Looks like an invalid email').max(120),
  phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^[+()\d\s\-.]*$/, 'Numbers, spaces, +, -, ( ) only')
    .optional()
    .or(z.literal('')),
  pitch: z
    .string()
    .trim()
    .min(20, 'A couple of sentences about you and what you bring')
    .max(800, "Let's keep it under 800 characters — you can elaborate in the interview"),
  portfolio_url: z
    .string()
    .trim()
    .max(280)
    .url('That doesn’t look like a URL')
    .optional()
    .or(z.literal('')),
  // Captures referrer / availability hints that don't deserve their own column.
  meta: z
    .object({
      heard_from: z.string().trim().max(80).optional(),
      availability: z.string().trim().max(120).optional(),
    })
    .optional(),
})

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>

export interface ApplicationRow {
  id: string
  role: ApplicationRole
  role_hint: string | null
  name: string
  email: string
  phone: string | null
  pitch: string
  portfolio_url: string | null
  meta_json: string | null
  status: ApplicationStatus
  notes: string | null
  created_at: number
  updated_at: number
}

export type CreateApplicationResult =
  | { ok: true; application_id: string }
  | { ok: false; reason: string }

// Friendlier label for the four roles we publish — used in TG cards and the
// admin table so we don't have to translate "counter" → "Counter & coffee"
// in two places.
export const APPLICATION_ROLE_LABEL: Record<ApplicationRole, string> = {
  counter: 'Counter & coffee',
  baker: 'Baker / decorator',
  driver: 'Delivery driver',
  other: 'Other / open',
}

export function createApplication(args: CreateApplicationInput): CreateApplicationResult {
  const id = `app_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const now = Date.now()
  // Empty-string normalisation for optional URL/phone — the schema accepts
  // either `undefined` or "" so we collapse both to NULL in storage.
  const phone = args.phone && args.phone.length > 0 ? args.phone : null
  const portfolio = args.portfolio_url && args.portfolio_url.length > 0 ? args.portfolio_url : null
  const meta = args.meta && (args.meta.heard_from || args.meta.availability)
    ? JSON.stringify(args.meta)
    : null
  // role='other' MUST carry a hint; we surface it on the card so the
  // owner can decide if there's a real role in there.
  if (args.role === 'other' && !args.role_hint) {
    return { ok: false, reason: 'Tell us what role you have in mind.' }
  }
  try {
    getDb()
      .prepare(
        `INSERT INTO applications
         (id, role, role_hint, name, email, phone, pitch, portfolio_url, meta_json, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)`,
      )
      .run(
        id,
        args.role,
        args.role_hint ?? null,
        args.name,
        args.email,
        phone,
        args.pitch,
        portfolio,
        meta,
        now,
        now,
      )
    return { ok: true, application_id: id }
  } catch (err) {
    console.error('[applications] insert failed:', (err as Error).message)
    return { ok: false, reason: 'Could not save the application — try again in a moment.' }
  }
}

export function getApplication(id: string): ApplicationRow | null {
  return (
    (getDb()
      .prepare('SELECT * FROM applications WHERE id = ?')
      .get(id) as ApplicationRow | undefined) ?? null
  )
}

export interface ListFilter {
  status?: ApplicationStatus | 'all'
  role?: ApplicationRole | 'all'
  limit?: number
}

export function listApplications(filter: ListFilter = {}): ApplicationRow[] {
  const limit = filter.limit ?? 100
  const where: string[] = []
  const params: Array<string | number> = []
  if (filter.status && filter.status !== 'all') {
    where.push('status = ?')
    params.push(filter.status)
  }
  if (filter.role && filter.role !== 'all') {
    where.push('role = ?')
    params.push(filter.role)
  }
  const sql = `SELECT * FROM applications ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC LIMIT ?`
  return getDb()
    .prepare(sql)
    .all(...params, limit) as ApplicationRow[]
}

// Counts per status — used by the admin cockpit's filter chips so the
// owner sees "5 new · 2 reviewing · 1 interview" without an N+1 round-trip.
export function applicationCounts(): Record<ApplicationStatus | 'total', number> {
  const rows = getDb()
    .prepare('SELECT status, COUNT(*) AS c FROM applications GROUP BY status')
    .all() as Array<{ status: ApplicationStatus; c: number }>
  const out: Record<ApplicationStatus | 'total', number> = {
    new: 0,
    reviewing: 0,
    interview: 0,
    hired: 0,
    rejected: 0,
    total: 0,
  }
  for (const r of rows) {
    out[r.status] = r.c
    out.total += r.c
  }
  return out
}

export const updateApplicationSchema = z.object({
  application_id: z.string().min(3),
  status: z.enum(APPLICATION_STATUSES).optional(),
  notes: z.string().trim().max(2000).optional(),
})

export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>

export function updateApplication(args: UpdateApplicationInput): { ok: boolean; reason?: string } {
  if (args.status === undefined && args.notes === undefined) {
    return { ok: false, reason: 'Nothing to update.' }
  }
  const sets: string[] = []
  const params: Array<string | number> = []
  if (args.status !== undefined) {
    sets.push('status = ?')
    params.push(args.status)
  }
  if (args.notes !== undefined) {
    sets.push('notes = ?')
    params.push(args.notes)
  }
  sets.push('updated_at = ?')
  params.push(Date.now())
  params.push(args.application_id)
  const result = getDb()
    .prepare(`UPDATE applications SET ${sets.join(', ')} WHERE id = ?`)
    .run(...params)
  if (result.changes === 0) return { ok: false, reason: 'Application not found.' }
  return { ok: true }
}
