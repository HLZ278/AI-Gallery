import { clipboard, shell } from 'electron'
import { existsSync, unlinkSync } from 'fs'
import { getDb } from '../db/DatabaseManager'
import { copyMediaItemsToClipboard, type ClipboardMediaItem } from '../infra/ClipboardFiles'
import type { MediaType } from '../../../shared/types'

export class MediaService {
  removeFromDatabase(mediaId: string): void {
    const db = getDb()
    const row = db.prepare('SELECT file_path, thumb_path FROM media_items WHERE id = ?').get(mediaId) as
      | { file_path: string; thumb_path: string | null }
      | undefined
    if (!row) throw new Error('Media not found')

    db.prepare('DELETE FROM media_fts WHERE media_id = ?').run(mediaId)
    db.prepare('DELETE FROM media_items WHERE id = ?').run(mediaId)
    this.deleteThumb(row.thumb_path)
  }

  deleteFromDisk(mediaId: string): void {
    const db = getDb()
    const row = db.prepare('SELECT file_path, thumb_path FROM media_items WHERE id = ?').get(mediaId) as
      | { file_path: string; thumb_path: string | null }
      | undefined
    if (!row) throw new Error('Media not found')

    if (existsSync(row.file_path)) {
      unlinkSync(row.file_path)
    }

    db.prepare('DELETE FROM media_fts WHERE media_id = ?').run(mediaId)
    db.prepare('DELETE FROM media_items WHERE id = ?').run(mediaId)
    this.deleteThumb(row.thumb_path)
  }

  copyPath(filePath: string): void {
    clipboard.writeText(filePath)
  }

  copyMedia(filePath: string, mediaType?: MediaType): void {
    this.copyMediaItems([{ filePath, mediaType: mediaType ?? 'photo' }])
  }

  copyMediaItems(items: ClipboardMediaItem[]): void {
    copyMediaItemsToClipboard(items)
  }

  showInFolder(filePath: string): void {
    shell.showItemInFolder(filePath)
  }

  async openFile(filePath: string): Promise<void> {
    await shell.openPath(filePath)
  }

  private deleteThumb(thumbPath: string | null): void {
    if (thumbPath && existsSync(thumbPath)) {
      try {
        unlinkSync(thumbPath)
      } catch {
        /* ignore */
      }
    }
  }
}

export const mediaService = new MediaService()
