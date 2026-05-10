// Hourly snapshot rebuilder. Same single-timer pattern as content-studio's
// scheduler so boot + shutdown lines up. Idempotent (upsert on iso_date).

import { buildSnapshot } from './snapshot-builder.ts'
import { SqliteSnapshotRepository } from './repository-sqlite.ts'
import type { SnapshotRepository } from './repository.ts'

let timer: ReturnType<typeof setInterval> | null = null
let runningTick = false

interface Deps {
  intervalMs: number
  repo?: SnapshotRepository
}

export function startSnapshotScheduler(opts: Deps): void {
  if (timer !== null) return
  const repo = opts.repo ?? new SqliteSnapshotRepository()

  void tick(repo).then((s) => {
    if (s) console.log(`[snapshot-scheduler] boot: built ${s.iso_date}`)
  })

  timer = setInterval(() => {
    void tick(repo)
  }, opts.intervalMs)
  if (typeof timer.unref === 'function') timer.unref()
}

export function stopSnapshotScheduler(): void {
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
}

export async function tick(repo: SnapshotRepository): Promise<{ iso_date: string } | null> {
  if (runningTick) return null
  runningTick = true
  try {
    const snapshot = await buildSnapshot()
    repo.save(snapshot)
    return { iso_date: snapshot.iso_date }
  } catch (err) {
    console.warn(`[snapshot-scheduler] tick failed: ${(err as Error).message}`)
    return null
  } finally {
    runningTick = false
  }
}
