import { getDb } from '../db/DatabaseManager'
import { configService } from '../services/ConfigService'
import { mediaRepository } from '../infra/FileScanner'
import { upsertMediaFts } from './MediaFtsIndexer'
import { parseAnalysisExtendedFields, toAnalysisFtsPayload } from './AnalysisPayloadMapper'
import { embeddingService } from '../services/EmbeddingService'
import { createImageAnalysisProvider, resolveAnalysisModeForJob } from '../infra/analysis/AnalysisProviderFactory'
import { buildAnalysisModelName } from './AnalysisModelName'
import type { AnalysisMode, AnalysisProgress, AnalysisResult, ImageAnalysisPayload } from '../../../shared/types'

type ProgressCallback = (progress: AnalysisProgress) => void

interface QueuedJob {
  mediaId: string
  mode: AnalysisMode
}

export class AnalysisQueue {
  private running = false
  private stopRequested = false
  private listeners: ProgressCallback[] = []
  private processingItems = new Map<string, string>()
  private forcedModeQueue: QueuedJob[] = []
  private libraryFilter: string | null = null
  /** 非空时仅处理这些 mediaId（单张重分析 / 批量增强） */
  private scopeMediaIds: Set<string> | null = null
  private cancelledMediaIds = new Set<string>()

  onProgress(cb: ProgressCallback): () => void {
    this.listeners.push(cb)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb)
    }
  }

  private emit(): void {
    const progress = this.getProgress()
    for (const cb of this.listeners) cb(progress)
  }

  getProgress(): AnalysisProgress {
    const db = getDb()
    const counts = db.prepare(`
      SELECT analysis_status, COUNT(*) as cnt FROM media_items GROUP BY analysis_status
    `).all() as Array<{ analysis_status: string; cnt: number }>
    const map = Object.fromEntries(counts.map((c) => [c.analysis_status, c.cnt]))
    const pending = map.pending ?? 0
    const processing = map.processing ?? 0
    const done = map.done ?? 0
    const failed = map.failed ?? 0
    const total = pending + processing + done + failed
    const completed = done + failed
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0

    const currentFiles = Array.from(this.processingItems.entries()).map(([mediaId, filePath]) => ({
      mediaId,
      filePath,
      fileName: filePath.split(/[/\\]/).pop() ?? filePath
    }))

    const config = configService.load()
    const concurrency =
      this.running && !this.stopRequested
        ? Math.max(1, config.analysis.defaultMode === 'local' ? config.analysis.localConcurrency : config.llm.maxConcurrency)
        : undefined

    return {
      pending,
      processing,
      done,
      failed,
      isRunning: this.running && !this.stopRequested,
      isStopping: this.stopRequested,
      total,
      completed,
      percent,
      currentFiles,
      concurrency
    }
  }

  async start(libraryId?: string): Promise<void> {
    if (this.running) {
      if (this.stopRequested) return
      return
    }
    this.libraryFilter = libraryId ?? null
    this.scopeMediaIds = null
    this.stopRequested = false
    this.running = true
    void this.processLoop()
  }

  stop(): void {
    if (!this.running) return
    this.stopRequested = true
    this.emit()
  }

  pause(): void {
    this.stop()
  }

  async retryMedia(mediaId: string, mode?: AnalysisMode): Promise<void> {
    mediaRepository.setStatus(mediaId, 'pending', null)
    if (mode === 'cloud' || mode === 'local') {
      this.enqueueForcedMode(mediaId, mode)
    }
    this.scopeMediaIds = new Set([mediaId])
    await this.ensureRunning()
  }

  async enhanceMedia(mediaId: string): Promise<void> {
    const config = configService.load()
    if (!config.llm.apiKey) {
      throw new Error('请先在设置中配置 API Key 以使用云端增强分析')
    }
    mediaRepository.setStatus(mediaId, 'pending', null)
    this.enqueueForcedMode(mediaId, 'cloud')
    this.scopeMediaIds = new Set([mediaId])
    await this.ensureRunning()
  }

  async enhanceBatch(mediaIds: string[]): Promise<number> {
    const config = configService.load()
    if (!config.llm.apiKey) {
      throw new Error('请先在设置中配置 API Key 以使用云端增强分析')
    }
    let count = 0
    for (const mediaId of mediaIds) {
      mediaRepository.setStatus(mediaId, 'pending', null)
      this.enqueueForcedMode(mediaId, 'cloud')
      count++
    }
    if (count > 0) {
      this.scopeMediaIds = new Set(mediaIds)
      await this.ensureRunning()
    }
    return count
  }

  cancelMedia(mediaId: string): void {
    this.cancelledMediaIds.add(mediaId)
    this.forcedModeQueue = this.forcedModeQueue.filter((j) => j.mediaId !== mediaId)
    if (!this.processingItems.has(mediaId)) {
      this.revertCancelledStatus(mediaId)
      this.cancelledMediaIds.delete(mediaId)
    }
    this.emit()
  }

  private async ensureRunning(): Promise<void> {
    if (this.running) {
      if (this.stopRequested) this.stopRequested = false
      return
    }
    this.libraryFilter = null
    this.stopRequested = false
    this.running = true
    void this.processLoop()
  }

  private revertCancelledStatus(mediaId: string): void {
    const hasAnalysis = Boolean(
      getDb().prepare('SELECT 1 FROM analysis_results WHERE media_id = ?').get(mediaId)
    )
    mediaRepository.setStatus(mediaId, hasAnalysis ? 'done' : 'pending', null)
  }

  private claimOptions(): { libraryId?: string; mediaIds?: string[] } {
    if (this.scopeMediaIds?.size) {
      return { mediaIds: [...this.scopeMediaIds] }
    }
    if (this.libraryFilter) {
      return { libraryId: this.libraryFilter }
    }
    return {}
  }

  private hasWorkRemaining(): boolean {
    return mediaRepository.hasPending(this.claimOptions())
  }

  private enqueueForcedMode(mediaId: string, mode: AnalysisMode): void {
    if (!this.forcedModeQueue.some((j) => j.mediaId === mediaId)) {
      this.forcedModeQueue.push({ mediaId, mode })
    }
  }

  private dequeueMode(mediaId: string): AnalysisMode | undefined {
    const idx = this.forcedModeQueue.findIndex((j) => j.mediaId === mediaId)
    if (idx >= 0) {
      const job = this.forcedModeQueue.splice(idx, 1)[0]
      return job.mode
    }
    return undefined
  }

  async retryAllFailed(): Promise<number> {
    const rows = getDb()
      .prepare(`SELECT id FROM media_items WHERE analysis_status = 'failed'`)
      .all() as Array<{ id: string }>
    for (const { id } of rows) {
      mediaRepository.setStatus(id, 'pending', null)
    }
    if (rows.length > 0 && !this.running) await this.start()
    return rows.length
  }

  private getMaxConcurrency(): number {
    const config = configService.load()
    const pendingCloud = this.forcedModeQueue.some((j) => j.mode === 'cloud')
    if (config.analysis.defaultMode === 'local' && !pendingCloud) {
      return Math.max(1, Math.min(config.analysis.localConcurrency, 8))
    }
    return Math.max(1, Math.min(config.llm.maxConcurrency, 16))
  }

  private async processLoop(): Promise<void> {
    const inFlight = new Set<Promise<void>>()

    try {
      while (this.running) {
        if (this.stopRequested) {
          if (inFlight.size === 0) break
          await Promise.race([...inFlight, sleep(200)])
          continue
        }

        const maxConcurrency = this.getMaxConcurrency()

        while (inFlight.size < maxConcurrency && this.running && !this.stopRequested) {
          const item = mediaRepository.claimNextPending(this.claimOptions())
          if (!item) break

          const queuedMode = this.dequeueMode(item.id)
          const task = this.processOne(item.id, item.file_path, queuedMode).finally(() => {
            inFlight.delete(task)
          })
          inFlight.add(task)
          this.emit()
        }

        if (this.stopRequested) {
          if (inFlight.size === 0) break
          await Promise.race([...inFlight, sleep(200)])
          continue
        }

        if (inFlight.size === 0) {
          if (!this.hasWorkRemaining()) break
          await sleep(100)
          continue
        }

        await Promise.race(inFlight)
        this.emit()
      }

      await Promise.all(inFlight)
    } finally {
      if (this.stopRequested) {
        this.revertProcessingToPending()
      }
      this.running = false
      this.stopRequested = false
      this.libraryFilter = null
      this.scopeMediaIds = null
      this.emit()
    }
  }

  private revertProcessingToPending(): void {
    getDb().prepare(`UPDATE media_items SET analysis_status = 'pending' WHERE analysis_status = 'processing'`).run()
  }

  private async processOne(mediaId: string, filePath: string, forcedMode?: AnalysisMode): Promise<void> {
    if (this.cancelledMediaIds.has(mediaId)) {
      this.revertCancelledStatus(mediaId)
      this.cancelledMediaIds.delete(mediaId)
      return
    }

    const config = configService.load()
    this.processingItems.set(mediaId, filePath)
    this.emit()

    let lastError: Error | null = null
    let cancelled = false
    try {
      for (let attempt = 0; attempt <= config.llm.maxRetries; attempt++) {
        if (this.stopRequested || this.cancelledMediaIds.has(mediaId)) {
          cancelled = this.cancelledMediaIds.has(mediaId)
          return
        }
        try {
          const mode = await resolveAnalysisModeForJob(forcedMode)
          const provider = createImageAnalysisProvider(mode)
          const { payload, promptVersion } = await provider.analyzeFile(filePath, mediaId)
          if (this.stopRequested || this.cancelledMediaIds.has(mediaId)) {
            cancelled = this.cancelledMediaIds.has(mediaId)
            return
          }
          const modelName = buildAnalysisModelName(mode)
          this.saveAnalysis(mediaId, payload, modelName, promptVersion)
          mediaRepository.setStatus(mediaId, 'done')
          embeddingService.scheduleIndex(mediaId)
          return
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err))
          await sleep(1000 * (attempt + 1))
        }
      }
      if (!this.stopRequested && !this.cancelledMediaIds.has(mediaId)) {
        console.error(`Analysis failed for ${filePath}:`, lastError)
        mediaRepository.setStatus(mediaId, 'failed', lastError?.message ?? '分析失败')
      } else if (this.cancelledMediaIds.has(mediaId)) {
        cancelled = true
      }
    } finally {
      if (cancelled) {
        this.revertCancelledStatus(mediaId)
        this.cancelledMediaIds.delete(mediaId)
      }
      this.processingItems.delete(mediaId)
      this.emit()
    }
  }

  private saveAnalysis(
    mediaId: string,
    payload: ImageAnalysisPayload,
    modelName: string,
    promptVersion: string
  ): void {
    const db = getDb()
    const rawJson = JSON.stringify(payload)
    db.prepare(`
      INSERT INTO analysis_results (media_id, raw_json, description, objects, people, scene, location, story, trend_tags, mood, colors, ocr_text, model_name, prompt_version, analyzed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(media_id) DO UPDATE SET
        raw_json=excluded.raw_json, description=excluded.description, objects=excluded.objects,
        people=excluded.people, scene=excluded.scene, location=excluded.location, story=excluded.story,
        trend_tags=excluded.trend_tags, mood=excluded.mood, colors=excluded.colors, ocr_text=excluded.ocr_text,
        model_name=excluded.model_name, prompt_version=excluded.prompt_version, analyzed_at=excluded.analyzed_at
    `).run(
      mediaId, rawJson, payload.description, JSON.stringify(payload.objects), JSON.stringify(payload.people),
      payload.scene, payload.location, payload.story, JSON.stringify(payload.trend_tags), payload.mood,
      JSON.stringify(payload.colors), payload.ocr_text, modelName, promptVersion, Date.now()
    )

    upsertMediaFts(db, mediaId, toAnalysisFtsPayload(payload))
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const analysisQueue = new AnalysisQueue()

export function mapAnalysisRow(row: Record<string, unknown>): AnalysisResult {
  const rawJson = row.raw_json as string
  const extended = parseAnalysisExtendedFields(rawJson)
  return {
    mediaId: row.media_id as string,
    rawJson,
    description: row.description as string,
    objects: JSON.parse((row.objects as string) || '[]'),
    people: JSON.parse((row.people as string) || '[]'),
    scene: row.scene as string,
    location: row.location as string,
    story: row.story as string,
    trendTags: JSON.parse((row.trend_tags as string) || '[]'),
    mood: row.mood as string,
    colors: JSON.parse((row.colors as string) || '[]'),
    ocrText: row.ocr_text as string,
    ipReferences: extended.ip_references ?? [],
    isMeme: extended.is_meme ?? false,
    modelName: row.model_name as string,
    promptVersion: row.prompt_version as string,
    analyzedAt: row.analyzed_at as number
  }
}
