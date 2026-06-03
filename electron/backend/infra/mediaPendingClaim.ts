import type Database from 'better-sqlite3'

export type PendingClaimOptions = { libraryId?: string; mediaIds?: string[] }

export function claimNextPending(
  db: Database.Database,
  options?: PendingClaimOptions
): { id: string; file_path: string } | null {
  const libraryId = options?.libraryId
  const mediaIds = options?.mediaIds?.filter(Boolean)
  return db.transaction(() => {
    let row: { id: string; file_path: string } | undefined
    if (mediaIds && mediaIds.length > 0) {
      const placeholders = mediaIds.map(() => '?').join(', ')
      row = db
        .prepare(
          `SELECT id, file_path FROM media_items WHERE analysis_status = 'pending' AND id IN (${placeholders}) ORDER BY taken_at ASC LIMIT 1`
        )
        .get(...mediaIds) as { id: string; file_path: string } | undefined
    } else if (libraryId) {
      row = db
        .prepare(
          `SELECT id, file_path FROM media_items WHERE analysis_status = 'pending' AND library_id = ? ORDER BY taken_at ASC LIMIT 1`
        )
        .get(libraryId) as { id: string; file_path: string } | undefined
    } else {
      row = db
        .prepare(`SELECT id, file_path FROM media_items WHERE analysis_status = 'pending' ORDER BY taken_at ASC LIMIT 1`)
        .get() as { id: string; file_path: string } | undefined
    }
    if (!row) return null
    const result = db
      .prepare(`UPDATE media_items SET analysis_status = 'processing' WHERE id = ? AND analysis_status = 'pending'`)
      .run(row.id)
    return result.changes > 0 ? row : null
  })()
}

export function hasPending(db: Database.Database, options?: PendingClaimOptions): boolean {
  const libraryId = options?.libraryId
  const mediaIds = options?.mediaIds?.filter(Boolean)
  let row: unknown
  if (mediaIds && mediaIds.length > 0) {
    const placeholders = mediaIds.map(() => '?').join(', ')
    row = db
      .prepare(
        `SELECT 1 FROM media_items WHERE analysis_status = 'pending' AND id IN (${placeholders}) LIMIT 1`
      )
      .get(...mediaIds)
  } else if (libraryId) {
    row = db
      .prepare(`SELECT 1 FROM media_items WHERE analysis_status = 'pending' AND library_id = ? LIMIT 1`)
      .get(libraryId)
  } else {
    row = db.prepare(`SELECT 1 FROM media_items WHERE analysis_status = 'pending' LIMIT 1`).get()
  }
  return Boolean(row)
}
