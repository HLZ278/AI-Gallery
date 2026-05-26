import { getDb } from '../db/DatabaseManager'
import { configService } from './ConfigService'
import { fileScanner, thumbnailGenerator, mediaRepository } from '../infra/FileScanner'

export async function importSingleFile(libraryId: string, filePath: string): Promise<boolean> {
  const config = configService.load()
  const scanned = await fileScanner.analyzeFile(filePath)
  if (!scanned) return false

  const existing = mediaRepository.findByPath(filePath)
  if (existing) {
    if (config.analysis.skipIfHashUnchanged && existing.file_hash === scanned.fileHash && existing.analysis_status === 'done') {
      return false
    }
    mediaRepository.updateHashAndStatus(existing.id, scanned.fileHash, 'pending')
    return false
  }

  const mediaId = mediaRepository.insertMedia(libraryId, scanned, null, 'pending')
  const thumb = await thumbnailGenerator.generate(filePath, mediaId)
  if (thumb) {
    getDb().prepare('UPDATE media_items SET thumb_path = ? WHERE id = ?').run(thumb, mediaId)
  }
  return true
}
