import { v4 as uuidv4 } from 'uuid'
import { shell } from 'electron'
import { getDb } from '../db/DatabaseManager'
import { analysisQueue } from '../domain/AnalysisQueue'
import { fileScanner } from '../infra/FileScanner'
import { importSingleFile } from './ImportHelper'
import type { ImportProgress, Library } from '../../../shared/types'

type ProgressEmitter = (progress: ImportProgress) => void

export class LibraryService {
  list(): Library[] {
    const db = getDb()
    const rows = db.prepare(`
      SELECT l.*,
        (SELECT COUNT(*) FROM media_items m WHERE m.library_id = l.id) as media_count,
        (SELECT COUNT(*) FROM media_items m WHERE m.library_id = l.id AND m.analysis_status = 'done') as analyzed_count,
        (SELECT COUNT(*) FROM media_items m WHERE m.library_id = l.id AND m.analysis_status = 'pending') as pending_count,
        (SELECT COUNT(*) FROM media_items m WHERE m.library_id = l.id AND m.analysis_status = 'processing') as processing_count,
        (SELECT COALESCE(SUM(m.file_size), 0) FROM media_items m WHERE m.library_id = l.id) as total_size
      FROM libraries l ORDER BY l.created_at DESC
    `).all() as Array<Record<string, unknown>>

    return rows.map(this.mapLibrary)
  }

  add(rootPath: string, name?: string): Library {
    const db = getDb()
    const id = uuidv4()
    const displayName = name ?? rootPath.split(/[/\\]/).pop() ?? '图库'
    db.prepare('INSERT INTO libraries (id, name, root_path, created_at) VALUES (?, ?, ?, ?)').run(
      id, displayName, rootPath, Date.now()
    )
    return this.get(id)!
  }

  get(id: string): Library | null {
    const row = getDb().prepare('SELECT * FROM libraries WHERE id = ?').get(id) as Record<string, unknown> | undefined
    return row ? this.mapLibrary(row) : null
  }

  remove(id: string): void {
    getDb().prepare('DELETE FROM libraries WHERE id = ?').run(id)
  }

  openLocation(rootPath: string): Promise<string> {
    return shell.openPath(rootPath)
  }

  async scan(libraryId: string, onProgress?: ProgressEmitter): Promise<{ imported: number }> {
    const library = this.get(libraryId)
    if (!library) throw new Error('Library not found')

    onProgress?.({ total: 0, processed: 0, currentFile: '', phase: 'scanning', message: '正在扫描目录...' })
    const files = await fileScanner.scanDirectory(library.rootPath)
    onProgress?.({ total: files.length, processed: 0, currentFile: '', phase: 'importing', message: `发现 ${files.length} 个媒体文件` })

    let added = 0
    let updated = 0
    for (let i = 0; i < files.length; i++) {
      const filePath = files[i]
      onProgress?.({ total: files.length, processed: i, currentFile: filePath, phase: 'importing', message: `导入中 ${i + 1}/${files.length}` })
      const result = await importSingleFile(libraryId, filePath)
      if (result.action === 'added') added++
      else if (result.action === 'updated') updated++
    }

    const summary =
      updated > 0
        ? `扫描完成，新增 ${added} 个，更新 ${updated} 个，可点击「开始分析」处理待分析项`
        : `扫描完成，新增 ${added} 个文件，可点击「开始分析」处理待分析项`
    onProgress?.({ total: files.length, processed: files.length, currentFile: '', phase: 'done', message: summary })
    return { imported: added }
  }

  private mapLibrary(row: Record<string, unknown>): Library {
    return {
      id: row.id as string,
      name: row.name as string,
      rootPath: row.root_path as string,
      createdAt: row.created_at as number,
      mediaCount: row.media_count as number | undefined,
      analyzedCount: row.analyzed_count as number | undefined,
      pendingCount: row.pending_count as number | undefined,
      processingCount: row.processing_count as number | undefined,
      totalSize: row.total_size as number | undefined
    }
  }
}

export class ImportService {
  private progressListeners: ProgressEmitter[] = []

  onProgress(cb: ProgressEmitter): () => void {
    this.progressListeners.push(cb)
    return () => {
      this.progressListeners = this.progressListeners.filter((l) => l !== cb)
    }
  }

  private emit(progress: ImportProgress): void {
    for (const cb of this.progressListeners) cb(progress)
  }

  async importFiles(libraryId: string, filePaths: string[]): Promise<{ imported: number }> {
    this.emit({ total: filePaths.length, processed: 0, currentFile: '', phase: 'importing', message: '开始导入...' })
    let added = 0
    let updated = 0
    for (let i = 0; i < filePaths.length; i++) {
      const fp = filePaths[i]
      this.emit({ total: filePaths.length, processed: i, currentFile: fp, phase: 'importing', message: `导入 ${i + 1}/${filePaths.length}` })
      const result = await importSingleFile(libraryId, fp)
      if (result.action === 'added') added++
      else if (result.action === 'updated') updated++
    }
    this.emit({ total: filePaths.length, processed: filePaths.length, currentFile: '', phase: 'analyzing', message: '启动分析队列...' })
    await analysisQueue.start()
    const summary =
      updated > 0 ? `导入完成，新增 ${added} 个，更新 ${updated} 个` : `导入完成 ${added} 个`
    this.emit({ total: filePaths.length, processed: filePaths.length, currentFile: '', phase: 'done', message: summary })
    return { imported: added }
  }
}

export const libraryService = new LibraryService()
export const importService = new ImportService()
