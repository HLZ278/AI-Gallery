import { createHash } from 'crypto'
import { createReadStream, readdirSync, statSync, renameSync, unlinkSync } from 'fs'
import { join } from 'path'
import exifr from 'exifr'
import sharp from 'sharp'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db/DatabaseManager'
import { buildExifGeoText, EXIF_GPS_FIELDS } from '../domain/ExifGeoText'
import { indexGeoOnlyFts } from '../domain/MediaFtsIndexer'
import { mediaClassifier, isMediaFile, getThumbsDir } from '../domain/MediaClassifier'
import { probeMediaMeta } from './MediaProbe'
import { extractVideoThumbnail, isVideoFile } from './VideoFrameExtractor'
import type { MediaType, AnalysisStatus } from '../../../shared/types'

export interface ScannedFile {
  filePath: string
  fileHash: string
  fileSize: number
  width: number
  height: number
  takenAt: number | null
  mediaType: MediaType
  exifJson: string | null
  isPanorama: number
  durationMs: number | null
  frameCount: number | null
}

async function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

async function getImageDimensions(filePath: string): Promise<{ width: number; height: number }> {
  try {
    const meta = await sharp(filePath).metadata()
    return { width: meta.width ?? 0, height: meta.height ?? 0 }
  } catch {
    return { width: 0, height: 0 }
  }
}

export class FileScanner {
  async scanDirectory(dirPath: string): Promise<string[]> {
    const results: string[] = []
    const walk = (dir: string): void => {
      let entries: string[]
      try {
        entries = readdirSync(dir)
      } catch {
        return
      }
      const siblings = entries.map((e) => join(dir, e))
      for (const entry of entries) {
        const fullPath = join(dir, entry)
        try {
          const stat = statSync(fullPath)
          if (stat.isDirectory()) {
            walk(fullPath)
          } else if (isMediaFile(fullPath)) {
            results.push(fullPath)
          }
        } catch {
          /* skip inaccessible files */
        }
      }
    }
    walk(dirPath)
    return results
  }

  async analyzeFile(filePath: string, siblingFiles?: string[]): Promise<ScannedFile | null> {
    if (!isMediaFile(filePath)) return null
    try {
      const stat = statSync(filePath)
      const fileHash = await hashFile(filePath)
      let { width, height } = await getImageDimensions(filePath)
      let exif: Record<string, unknown> | undefined
      let takenAt: number | null = null
      try {
        exif = (await exifr.parse(filePath, {
          pick: ['DateTimeOriginal', 'CreateDate', 'ContentIdentifier', 'ProjectionType', ...EXIF_GPS_FIELDS]
        })) as Record<string, unknown> | undefined
        const dateVal = exif?.DateTimeOriginal ?? exif?.CreateDate
        if (dateVal instanceof Date) takenAt = dateVal.getTime()
        else if (typeof dateVal === 'string') takenAt = new Date(dateVal).getTime()
      } catch {
        exif = undefined
      }
      if (!takenAt) takenAt = stat.mtimeMs
      const mediaType = mediaClassifier.classify({ filePath, width, height, exif, siblingFiles })
      const isPanorama = mediaType === 'panorama' ? 1 : 0
      const probed = await probeMediaMeta(filePath, mediaType)
      if (probed.width && !width) width = probed.width
      if (probed.height && !height) height = probed.height
      return {
        filePath,
        fileHash,
        fileSize: stat.size,
        width,
        height,
        takenAt,
        mediaType,
        exifJson: exif ? JSON.stringify(exif) : null,
        isPanorama,
        durationMs: probed.durationMs,
        frameCount: probed.frameCount
      }
    } catch {
      return null
    }
  }
}

export class ThumbnailGenerator {
  async generate(filePath: string, mediaId: string): Promise<string | null> {
    const thumbPath = join(getThumbsDir(), `${mediaId}.jpg`)

    if (isVideoFile(filePath)) {
      const ok = await extractVideoThumbnail(filePath, thumbPath)
      if (!ok) return null
      try {
        const tmpPath = `${thumbPath}.tmp.jpg`
        await sharp(thumbPath).resize(400, 400, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toFile(tmpPath)
        unlinkSync(thumbPath)
        renameSync(tmpPath, thumbPath)
      } catch {
        /* 保留 ffmpeg 原图 */
      }
      return thumbPath
    }

    try {
      await sharp(filePath)
        .rotate()
        .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toFile(thumbPath)
      return thumbPath
    } catch {
      return null
    }
  }
}

export class MediaRepository {
  insertMedia(
    libraryId: string,
    scanned: ScannedFile,
    thumbPath: string | null,
    status: AnalysisStatus = 'pending'
  ): string {
    const db = getDb()
    const id = uuidv4()
    db.prepare(`
      INSERT INTO media_items (id, library_id, file_path, file_hash, file_size, width, height, taken_at, imported_at, media_type, thumb_path, analysis_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, libraryId, scanned.filePath, scanned.fileHash, scanned.fileSize, scanned.width, scanned.height, scanned.takenAt, Date.now(), scanned.mediaType, thumbPath, status)
    const geoText = buildExifGeoText(scanned.exifJson)
    db.prepare(`
      INSERT INTO media_metadata (media_id, exif_json, geo_text, is_panorama, duration_ms, frame_count)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, scanned.exifJson, geoText || null, scanned.isPanorama, scanned.durationMs, scanned.frameCount)
    if (geoText) indexGeoOnlyFts(db, id, geoText)
    return id
  }

  findByPath(filePath: string): { id: string; file_hash: string; analysis_status: string } | undefined {
    return getDb().prepare('SELECT id, file_hash, analysis_status FROM media_items WHERE file_path = ?').get(filePath) as
      | { id: string; file_hash: string; analysis_status: string }
      | undefined
  }

  updateHashAndStatus(id: string, fileHash: string, status: AnalysisStatus): void {
    getDb().prepare('UPDATE media_items SET file_hash = ?, analysis_status = ? WHERE id = ?').run(fileHash, status, id)
  }

  getPendingItems(limit = 50): Array<{ id: string; file_path: string; file_hash: string; library_id: string }> {
    return getDb()
      .prepare(`SELECT id, file_path, file_hash, library_id FROM media_items WHERE analysis_status = 'pending' ORDER BY taken_at ASC LIMIT ?`)
      .all(limit) as Array<{ id: string; file_path: string; file_hash: string; library_id: string }>
  }

  /** 原子认领下一张待分析图片，避免多线程重复处理 */
  claimNextPending(options?: { libraryId?: string; mediaIds?: string[] }): { id: string; file_path: string } | null {
    const db = getDb()
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

  hasPending(options?: { libraryId?: string; mediaIds?: string[] }): boolean {
    const libraryId = options?.libraryId
    const mediaIds = options?.mediaIds?.filter(Boolean)
    let row: unknown
    if (mediaIds && mediaIds.length > 0) {
      const placeholders = mediaIds.map(() => '?').join(', ')
      row = getDb()
        .prepare(
          `SELECT 1 FROM media_items WHERE analysis_status = 'pending' AND id IN (${placeholders}) LIMIT 1`
        )
        .get(...mediaIds)
    } else if (libraryId) {
      row = getDb()
        .prepare(`SELECT 1 FROM media_items WHERE analysis_status = 'pending' AND library_id = ? LIMIT 1`)
        .get(libraryId)
    } else {
      row = getDb().prepare(`SELECT 1 FROM media_items WHERE analysis_status = 'pending' LIMIT 1`).get()
    }
    return Boolean(row)
  }

  setStatus(id: string, status: AnalysisStatus, analysisError?: string | null): void {
    if (analysisError !== undefined) {
      getDb()
        .prepare('UPDATE media_items SET analysis_status = ?, analysis_error = ? WHERE id = ?')
        .run(status, analysisError, id)
      return
    }
    if (status === 'pending' || status === 'processing' || status === 'done') {
      getDb()
        .prepare('UPDATE media_items SET analysis_status = ?, analysis_error = NULL WHERE id = ?')
        .run(status, id)
      return
    }
    getDb().prepare('UPDATE media_items SET analysis_status = ? WHERE id = ?').run(status, id)
  }

}

export const fileScanner = new FileScanner()
export const thumbnailGenerator = new ThumbnailGenerator()
export const mediaRepository = new MediaRepository()
