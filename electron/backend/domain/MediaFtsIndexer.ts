import type Database from 'better-sqlite3'

export interface AnalysisFtsPayload {
  description: string
  objects: string[]
  people: string[]
  scene: string
  location: string
  story: string
  trend_tags: string[]
  ocr_text: string
  ip_references?: string[]
}

function mergeLocationText(aiLocation: string, geoText: string): string {
  return [aiLocation, geoText].map((part) => part.trim()).filter(Boolean).join(' ')
}

export function readMediaGeoText(db: Database.Database, mediaId: string): string {
  const row = db.prepare('SELECT geo_text FROM media_metadata WHERE media_id = ?').get(mediaId) as
    | { geo_text?: string | null }
    | undefined
  return row?.geo_text?.trim() ?? ''
}

export function upsertMediaFts(
  db: Database.Database,
  mediaId: string,
  payload: AnalysisFtsPayload | null,
  geoText?: string
): void {
  const geo = (geoText ?? readMediaGeoText(db, mediaId)).trim()
  db.prepare('DELETE FROM media_fts WHERE media_id = ?').run(mediaId)

  if (!payload && !geo) return

  const location = mergeLocationText(payload?.location ?? '', geo)
  const peopleText = [...(payload?.people ?? []), ...(payload?.ip_references ?? [])].join(' ')
  const trendText = [...(payload?.trend_tags ?? []), ...(payload?.ip_references ?? [])].join(' ')

  db.prepare(`
    INSERT INTO media_fts (media_id, description, objects, people, scene, location, story, trend_tags, ocr_text)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    mediaId,
    payload?.description ?? '',
    (payload?.objects ?? []).join(' '),
    peopleText,
    payload?.scene ?? '',
    location,
    payload?.story ?? '',
    trendText,
    payload?.ocr_text ?? ''
  )
}

export function indexGeoOnlyFts(db: Database.Database, mediaId: string, geoText: string): void {
  const trimmed = geoText.trim()
  if (!trimmed) return
  upsertMediaFts(db, mediaId, null, trimmed)
}
