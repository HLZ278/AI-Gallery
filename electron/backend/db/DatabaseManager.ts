import Database from 'better-sqlite3'
import { existsSync, readFileSync, renameSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { APP_DB_FILENAME, LEGACY_DB_FILENAME } from '../../../shared/appMeta'
import { runMigrations } from './migrations'

let db: Database.Database | null = null

export function getDbPath(): string {
  const userData = app.getPath('userData')
  const current = join(userData, APP_DB_FILENAME)
  const legacy = join(userData, LEGACY_DB_FILENAME)
  if (!existsSync(current) && existsSync(legacy)) {
    try {
      renameSync(legacy, current)
    } catch (err) {
      console.warn('[Database] legacy db rename failed, using legacy path', err)
      return legacy
    }
  }
  return current
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
