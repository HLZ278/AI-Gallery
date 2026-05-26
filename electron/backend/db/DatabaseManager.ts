import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { runMigrations } from './migrations'

let db: Database.Database | null = null

export function getDbPath(): string {
  return join(app.getPath('userData'), 'yourpicture.db')
}

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(getDbPath())
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initSchema(db)
  }
  return db
}

function initSchema(database: Database.Database): void {
  const candidates = app.isPackaged
    ? [
        join(app.getAppPath(), 'electron/backend/db/schema.sql'),
        join(process.resourcesPath, 'app.asar.unpacked', 'electron/backend/db/schema.sql')
      ]
    : [
        join(app.getAppPath(), 'electron/backend/db/schema.sql'),
        join(process.cwd(), 'electron/backend/db/schema.sql'),
        join(__dirname, 'backend/db/schema.sql'),
        join(__dirname, '../backend/db/schema.sql')
      ]
  let schema = ''
  for (const p of candidates) {
    try {
      schema = readFileSync(p, 'utf-8')
      break
    } catch {
      /* try next */
    }
  }
  if (!schema) throw new Error('schema.sql not found')
  database.exec(schema)
  runMigrations(database)
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
