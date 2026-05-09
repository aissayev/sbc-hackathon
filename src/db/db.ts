// SQLite handle, lazily opened. Schema applied on first open.

import { Database } from 'bun:sqlite'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { config } from '../config.ts'

let _db: Database | null = null

export function getDb(): Database {
  if (_db) return _db
  mkdirSync(dirname(config.db.path), { recursive: true })
  _db = new Database(config.db.path)
  _db.exec('PRAGMA journal_mode = WAL')
  _db.exec('PRAGMA foreign_keys = ON')
  const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8')
  _db.exec(schema)
  return _db
}

export function closeDb() {
  _db?.close()
  _db = null
}
