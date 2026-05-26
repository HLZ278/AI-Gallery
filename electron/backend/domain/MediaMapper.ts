import type { MediaItem } from '../../../shared/types'

export const MEDIA_JOIN = `
  LEFT JOIN libraries l ON m.library_id = l.id
  LEFT JOIN media_metadata md ON md.media_id = m.id
`

export function mapMediaRow(row: Record<string, unknown>): MediaItem {
  return {
    id: row.id as string,
    libraryId: row.library_id as string,
    filePath: row.file_path as string,
    fileHash: row.file_hash as string,
    fileSize: row.file_size as number,
    width: row.width as number,
    height: row.height as number,
    takenAt: (row.taken_at as number) ?? null,
    importedAt: row.imported_at as number,
    mediaType: row.media_type as MediaItem['mediaType'],
    thumbPath: (row.thumb_path as string) ?? null,
    analysisStatus: row.analysis_status as MediaItem['analysisStatus'],
    analysisError: (row.analysis_error as string | null) ?? null,
    libraryName: row.library_name as string | undefined,
    durationMs: (row.duration_ms as number | null) ?? null,
    frameCount: (row.frame_count as number | null) ?? null,
    geoText: (row.geo_text as string | null) ?? null
  }
}
