import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { join } from 'path'
import { runMigrations } from '../../electron/backend/db/migrations'

export function createMemoryDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  const schemaPath = join(process.cwd(), 'electron/backend/db/schema.sql')
  db.exec(readFileSync(schemaPath, 'utf-8'))
  runMigrations(db)
  return db
}

export function seedLibrary(db: Database.Database, id = 'lib-1'): void {
  db.prepare('INSERT INTO libraries (id, name, root_path, created_at) VALUES (?, ?, ?, ?)').run(
    id,
    'Test',
    'C:\\test',
    Date.now()
  )
}

export function insertPendingMedia(
  db: Database.Database,
  opts: { id: string; libraryId?: string; takenAt?: number }
): void {
  const libraryId = opts.libraryId ?? 'lib-1'
  db.prepare(`
    INSERT INTO media_items (id, library_id, file_path, file_hash, file_size, width, height, taken_at, imported_at, media_type, thumb_path, analysis_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(
    opts.id,
    libraryId,
    `C:\\photos\\${opts.id}.jpg`,
    'hash',
    1000,
    100,
    100,
    opts.takenAt ?? 0,
    Date.now(),
    'photo',
    null
  )
}
