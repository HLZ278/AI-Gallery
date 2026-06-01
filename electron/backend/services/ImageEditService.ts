import { existsSync, mkdirSync, unlinkSync } from 'fs'
import { basename, dirname, extname, join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db/DatabaseManager'
import { buildExifGeoText } from '../domain/ExifGeoText'
import { indexGeoOnlyFts } from '../domain/MediaFtsIndexer'
import { configService } from './ConfigService'
import { imageEditClient } from '../infra/ImageEditClient'
import { moveFileSync } from '../infra/fileMove'
import { fileScanner, thumbnailGenerator, mediaRepository } from '../infra/FileScanner'
import { importSingleFile, shouldQueueAnalysis } from './ImportHelper'
import { analysisQueue } from '../domain/AnalysisQueue'
import { imageEditSessionService } from './ImageEditSessionService'
import { mapMediaRow, MEDIA_JOIN } from '../domain/MediaMapper'
import type {
  ImageEditAcceptResult,
  ImageEditOverwriteResult,
  ImageEditRequest,
  ImageEditResult,
  ImageEditSession,
  MediaItem,
  MediaType
} from '../../../shared/types'
import { APP_FILE_PREFIX } from '../../../shared/appMeta'
import { getImageEditSupportedTypes, resolveImageEditMediaTypes } from '../../../shared/imageEditPolicy'

interface PendingEdit {
  tempFilePath: string
  prompt: string
  sourceMediaIds: string[]
  sourceFilePaths: string[]
  sourceFileNames: string[]
  libraryId: string
  libraryName: string
  width: number
  height: number
  requestId?: string
}

export class ImageEditService {
  private pending = new Map<string, PendingEdit>()

  constructor() {
    this.rehydratePending()
  }

  loadSession(): ImageEditSession {
    const session = imageEditSessionService.load()
    this.rehydratePending(session.messages)
    return session
  }

  saveSession(session: ImageEditSession): void {
    imageEditSessionService.save(session)
    this.rehydratePending(session.messages)
  }

  listLibraryImages(
    libraryId: string,
    page = 1,
    pageSize = 120,
    mediaTypes?: MediaType[]
  ): MediaItem[] {
    const config = configService.load()
    const types = resolveImageEditMediaTypes(config, mediaTypes)
    if (types.length === 0) return []

    const offset = (page - 1) * pageSize
    const typePlaceholders = types.map(() => '?').join(', ')
    const rows = getDb()
      .prepare(`
        SELECT m.*, l.name as library_name, md.duration_ms, md.frame_count
        FROM media_items m
        ${MEDIA_JOIN}
        WHERE m.library_id = ?
          AND m.media_type IN (${typePlaceholders})
        ORDER BY m.taken_at DESC, m.imported_at DESC
        LIMIT ? OFFSET ?
      `)
      .all(libraryId, ...types, pageSize, offset) as Array<Record<string, unknown>>
    return rows.map(mapMediaRow)
  }

  private rehydratePending(messages?: ImageEditSession['messages']): void {
    const list = messages ?? imageEditSessionService.load().messages
    for (const msg of list) {
      if (msg.role !== 'assistant' || !msg.edit || msg.decision !== 'pending') continue
      const edit = msg.edit
      if (!existsSync(edit.tempFilePath)) continue
      this.pending.set(edit.editId, {
        tempFilePath: edit.tempFilePath,
        prompt: edit.prompt,
        sourceMediaIds: edit.sourceMediaIds,
        sourceFilePaths: edit.sourceFilePaths,
        sourceFileNames: edit.sourceFileNames,
        libraryId: edit.libraryId,
        libraryName: edit.libraryName,
        width: edit.width,
        height: edit.height,
        requestId: edit.requestId
      })
    }
  }

  private resolvePending(editId: string): PendingEdit {
    let pending = this.pending.get(editId)
    if (!pending) {
      this.rehydratePending()
      pending = this.pending.get(editId)
    }
    if (!pending) throw new Error('编辑记录不存在或已处理')
    if (!existsSync(pending.tempFilePath)) {
      this.pending.delete(editId)
      throw new Error('临时图片已不存在，请重新编辑')
    }
    return pending
  }

  private getMediaItems(mediaIds: string[]): MediaItem[] {
    if (mediaIds.length === 0) throw new Error('请至少选择一张源图片')
    const config = configService.load()
    if (mediaIds.length > config.imageEdit.maxInputImages) {
      throw new Error(`最多同时选择 ${config.imageEdit.maxInputImages} 张图片`)
    }

    const placeholders = mediaIds.map(() => '?').join(',')
    const rows = getDb()
      .prepare(`
        SELECT m.*, l.name as library_name, md.duration_ms, md.frame_count
        FROM media_items m
        ${MEDIA_JOIN}
        WHERE m.id IN (${placeholders})
      `)
      .all(...mediaIds) as Array<Record<string, unknown>>

    const items = mediaIds
      .map((id) => rows.find((row) => row.id === id))
      .filter((row): row is Record<string, unknown> => Boolean(row))
      .map(mapMediaRow)

    if (items.length !== mediaIds.length) throw new Error('部分源图片不存在')
    const supportedTypes = new Set(getImageEditSupportedTypes(config))
    for (const item of items) {
      if (!supportedTypes.has(item.mediaType)) {
        throw new Error(`「${basename(item.filePath)}」不是可编辑的图片类型`)
      }
      if (!existsSync(item.filePath)) throw new Error(`源文件不存在：${basename(item.filePath)}`)
    }
    return items
  }

  async edit(params: ImageEditRequest): Promise<ImageEditResult> {
    const prompt = params.prompt.trim()
    if (!prompt) throw new Error('请输入编辑指令')

    const sources = this.getMediaItems(params.sourceMediaIds)
    const libraryIds = new Set(sources.map((s) => s.libraryId))
    if (libraryIds.size > 1) throw new Error('请选择同一图库内的图片')

    const libraryId = sources[0].libraryId
    const libraryName = sources[0].libraryName ?? '图库'
    const editId = uuidv4()
    const apiResult = await imageEditClient.edit(
      sources.map((s) => s.filePath),
      prompt,
      editId,
      params.size
    )

    this.pending.set(editId, {
      tempFilePath: apiResult.tempFilePath,
      prompt,
      sourceMediaIds: sources.map((s) => s.id),
      sourceFilePaths: sources.map((s) => s.filePath),
      sourceFileNames: sources.map((s) => basename(s.filePath)),
      libraryId,
      libraryName,
      width: apiResult.width,
      height: apiResult.height,
      requestId: apiResult.requestId
    })

    return {
      editId,
      prompt,
      sourceMediaIds: sources.map((s) => s.id),
      sourceFilePaths: sources.map((s) => s.filePath),
      sourceFileNames: sources.map((s) => basename(s.filePath)),
      libraryId,
      libraryName,
      tempFilePath: apiResult.tempFilePath,
      width: apiResult.width,
      height: apiResult.height,
      requestId: apiResult.requestId
    }
  }

  async saveAsNew(editId: string): Promise<ImageEditAcceptResult> {
    const pending = this.resolvePending(editId)
    const config = configService.load()
    const subfolder = config.imageEdit.saveSubfolder.trim()
    const libraryRow = getDb().prepare('SELECT root_path FROM libraries WHERE id = ?').get(pending.libraryId) as
      | { root_path: string }
      | undefined
    if (!libraryRow) throw new Error('目标图库不存在')

    const targetDir = subfolder ? join(libraryRow.root_path, subfolder) : libraryRow.root_path
    mkdirSync(targetDir, { recursive: true })

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const targetPath = join(targetDir, `${APP_FILE_PREFIX}-edit-${timestamp}.png`)
    moveFileSync(pending.tempFilePath, targetPath)
    this.pending.delete(editId)

    const result = await importSingleFile(pending.libraryId, targetPath)
    if (shouldQueueAnalysis(result)) await analysisQueue.start()

    return {
      filePath: targetPath,
      libraryId: pending.libraryId,
      libraryName: pending.libraryName,
      imported: result.action === 'added'
    }
  }

  async overwrite(editId: string): Promise<ImageEditOverwriteResult> {
    const pending = this.resolvePending(editId)
    const primaryMediaId = pending.sourceMediaIds[0]
    const row = getDb()
      .prepare('SELECT id, library_id, file_path, thumb_path FROM media_items WHERE id = ?')
      .get(primaryMediaId) as
      | { id: string; library_id: string; file_path: string; thumb_path: string | null }
      | undefined
    if (!row) throw new Error('原图记录不存在')

    const originalPath = row.file_path
    const originalExt = extname(originalPath).toLowerCase()
    const targetPath =
      originalExt === '.png'
        ? originalPath
        : join(dirname(originalPath), `${basename(originalPath, originalExt)}.png`)

    moveFileSync(pending.tempFilePath, targetPath)
    this.pending.delete(editId)

    if (targetPath !== originalPath && existsSync(originalPath)) {
      unlinkSync(originalPath)
    }

    const db = getDb()
    if (targetPath !== originalPath) {
      db.prepare('UPDATE media_items SET file_path = ? WHERE id = ?').run(targetPath, row.id)
    }

    await this.refreshMediaRecord(row.id, targetPath, row.thumb_path)
    await analysisQueue.start()

    return {
      mediaId: row.id,
      filePath: targetPath,
      libraryId: row.library_id,
      libraryName: pending.libraryName,
      replacedOriginalPath: originalPath
    }
  }

  async reject(editId: string): Promise<void> {
    const pending = this.resolvePending(editId)
    if (existsSync(pending.tempFilePath)) {
      try {
        unlinkSync(pending.tempFilePath)
      } catch {
        /* ignore */
      }
    }
    this.pending.delete(editId)
  }

  private async refreshMediaRecord(mediaId: string, filePath: string, oldThumbPath: string | null): Promise<void> {
    const scanned = await fileScanner.analyzeFile(filePath)
    if (!scanned) throw new Error('无法解析编辑后的图片')

    const db = getDb()
    db.prepare(`
      UPDATE media_items
      SET file_hash = ?, file_size = ?, width = ?, height = ?, analysis_status = 'pending'
      WHERE id = ?
    `).run(scanned.fileHash, scanned.fileSize, scanned.width, scanned.height, mediaId)

    if (oldThumbPath && existsSync(oldThumbPath)) {
      try {
        unlinkSync(oldThumbPath)
      } catch {
        /* ignore */
      }
    }

    const thumb = await thumbnailGenerator.generate(filePath, mediaId)
    if (thumb) db.prepare('UPDATE media_items SET thumb_path = ? WHERE id = ?').run(thumb, mediaId)

    const geoText = buildExifGeoText(scanned.exifJson)
    db.prepare('UPDATE media_metadata SET exif_json = ?, geo_text = ? WHERE media_id = ?').run(
      scanned.exifJson,
      geoText || null,
      mediaId
    )

    db.prepare('DELETE FROM media_fts WHERE media_id = ?').run(mediaId)
    db.prepare('DELETE FROM analysis_results WHERE media_id = ?').run(mediaId)
    db.prepare('DELETE FROM media_embeddings WHERE media_id = ?').run(mediaId)
    if (geoText) indexGeoOnlyFts(db, mediaId, geoText)
    mediaRepository.updateHashAndStatus(mediaId, scanned.fileHash, 'pending')
  }
}

export const imageEditService = new ImageEditService()
