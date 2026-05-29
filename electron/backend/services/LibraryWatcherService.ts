import chokidar, { type FSWatcher } from 'chokidar'
import { getDb } from '../db/DatabaseManager'
import { importSingleFile, shouldQueueAnalysis } from './ImportHelper'
import { analysisQueue } from '../domain/AnalysisQueue'
import { mediaService } from './MediaService'
import { libraryService } from './LibraryService'

const DEBOUNCE_MS = 800

export class LibraryWatcherService {
  private watcher: FSWatcher | null = null
  private pendingImports = new Map<string, ReturnType<typeof setTimeout>>()

  async start(): Promise<void> {
    await this.restart()
  }

  async restart(): Promise<void> {
    await this.stop()
    const libraries = libraryService.list()
    if (libraries.length === 0) return

    const paths = libraries.map((lib) => lib.rootPath)
    this.watcher = chokidar.watch(paths, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
      ignored: (path) => path.includes('node_modules') || path.includes('.thumbnails')
    })

    this.watcher.on('add', (filePath) => this.scheduleImport(filePath))
    this.watcher.on('change', (filePath) => this.scheduleImport(filePath))
    this.watcher.on('unlink', (filePath) => {
      void this.handleRemoved(filePath)
    })
  }

  async stop(): Promise<void> {
    for (const timer of this.pendingImports.values()) clearTimeout(timer)
    this.pendingImports.clear()
    await this.watcher?.close()
    this.watcher = null
  }

  private scheduleImport(filePath: string): void {
    const existing = this.pendingImports.get(filePath)
    if (existing) clearTimeout(existing)
    this.pendingImports.set(
      filePath,
      setTimeout(() => {
        this.pendingImports.delete(filePath)
        void this.handleAdded(filePath)
      }, DEBOUNCE_MS)
    )
  }

  private async handleAdded(filePath: string): Promise<void> {
    const libraryId = this.resolveLibraryId(filePath)
    if (!libraryId) return
    try {
      const result = await importSingleFile(libraryId, filePath)
      if (shouldQueueAnalysis(result)) await analysisQueue.start()
    } catch (err) {
      console.error('Library watcher import failed:', filePath, err)
    }
  }

  private async handleRemoved(filePath: string): Promise<void> {
    const row = getDb()
      .prepare('SELECT id FROM media_items WHERE file_path = ?')
      .get(filePath) as { id: string } | undefined
    if (!row) return
    try {
      mediaService.removeFromDatabase(row.id)
    } catch (err) {
      console.error('Library watcher remove failed:', filePath, err)
    }
  }

  private resolveLibraryId(filePath: string): string | null {
    const normalized = filePath.replace(/\\/g, '/').toLowerCase()
    const libraries = libraryService.list()
    let best: { id: string; len: number } | null = null
    for (const lib of libraries) {
      const root = lib.rootPath.replace(/\\/g, '/').toLowerCase()
      if (normalized.startsWith(root) && (!best || root.length > best.len)) {
        best = { id: lib.id, len: root.length }
      }
    }
    return best?.id ?? null
  }
}

export const libraryWatcherService = new LibraryWatcherService()
