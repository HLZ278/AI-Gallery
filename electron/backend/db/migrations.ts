import type Database from 'better-sqlite3'
import { buildExifGeoText } from '../domain/ExifGeoText'
import { parseAnalysisExtendedFields } from '../domain/AnalysisPayloadMapper'
import { upsertMediaFts } from '../domain/MediaFtsIndexer'

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  return rows.some((row) => row.name === column)
}

function migrationApplied(db: Database.Database, id: string): boolean {
  const row = db.prepare('SELECT 1 FROM schema_migrations WHERE id = ?').get(id)
  return Boolean(row)
}

function markMigrationApplied(db: Database.Database, id: string): void {
  db.prepare('INSERT OR IGNORE INTO schema_migrations (id, applied_at) VALUES (?, ?)').run(id, Date.now())
}

function backfillGeoText(db: Database.Database): void {
  const rows = db
    .prepare(
      `SELECT media_id, exif_json FROM media_metadata WHERE exif_json IS NOT NULL AND (geo_text IS NULL OR geo_text = '')`
    )
    .all() as Array<{ media_id: string; exif_json: string }>

  const update = db.prepare('UPDATE media_metadata SET geo_text = ? WHERE media_id = ?')
  for (const row of rows) {
    const geoText = buildExifGeoText(row.exif_json)
    if (geoText) update.run(geoText, row.media_id)
  }
}

function reindexFtsFromAnalysis(db: Database.Database): void {
  const rows = db
    .prepare(`
      SELECT
        a.media_id,
        a.raw_json,
        a.description,
        a.objects,
        a.people,
        a.scene,
        a.location,
        a.story,
        a.trend_tags,
        a.ocr_text,
        md.geo_text
      FROM analysis_results a
      LEFT JOIN media_metadata md ON md.media_id = a.media_id
    `)
    .all() as Array<Record<string, unknown>>

  for (const row of rows) {
    const extended = parseAnalysisExtendedFields((row.raw_json as string) ?? '{}')
    upsertMediaFts(
      db,
      row.media_id as string,
      {
        description: (row.description as string) ?? '',
        objects: JSON.parse((row.objects as string) || '[]') as string[],
        people: JSON.parse((row.people as string) || '[]') as string[],
        scene: (row.scene as string) ?? '',
        location: (row.location as string) ?? '',
        story: (row.story as string) ?? '',
        trend_tags: JSON.parse((row.trend_tags as string) || '[]') as string[],
        ocr_text: (row.ocr_text as string) ?? '',
        ip_references: extended.ip_references ?? []
      },
      (row.geo_text as string | null) ?? undefined
    )
  }

  const pendingRows = db
    .prepare(`
      SELECT md.media_id, md.geo_text
      FROM media_metadata md
      LEFT JOIN analysis_results a ON a.media_id = md.media_id
      WHERE md.geo_text IS NOT NULL AND md.geo_text != '' AND a.media_id IS NULL
    `)
    .all() as Array<{ media_id: string; geo_text: string }>

  for (const row of pendingRows) {
    upsertMediaFts(db, row.media_id, null, row.geo_text)
  }
}

function reindexFtsWithGeo(db: Database.Database): void {
  reindexFtsFromAnalysis(db)
}

export function runMigrations(db: Database.Database): void {
  if (!hasColumn(db, 'media_metadata', 'geo_text')) {
    db.prepare('ALTER TABLE media_metadata ADD COLUMN geo_text TEXT').run()
  }

  backfillGeoText(db)

  if (!migrationApplied(db, 'geo_search_v1')) {
    reindexFtsWithGeo(db)
    markMigrationApplied(db, 'geo_search_v1')
  }

  if (!migrationApplied(db, 'entity_fts_v1')) {
    reindexFtsFromAnalysis(db)
    markMigrationApplied(db, 'entity_fts_v1')
  }
}
