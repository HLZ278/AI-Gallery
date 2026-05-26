import { getDb } from '../db/DatabaseManager'
import { configService } from '../services/ConfigService'
import { imageAnalyzer } from '../infra/LLMClient'
import { mediaRepository } from '../infra/FileScanner'
import { upsertMediaFts } from './MediaFtsIndexer'
import { parseAnalysisExtendedFields, toAnalysisFtsPayload } from './AnalysisPayloadMapper'
import { embeddingService } from '../services/EmbeddingService'
import type { AnalysisProgress, AnalysisResult, ImageAnalysisPayload } from '../../../shared/types'

type ProgressCallback = (progress: AnalysisProgress) => void

export class AnalysisQueue {
  private running = false
  private stopRequested = false
  private listeners: ProgressCallback[] = []
  private processingItems = new Map<string, string>()

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
      concurrency: this.running && !this.stopRequested
        ? Math.max(1, configService.load().llm.maxConcurrency)
        : undefined
    }
  }

  async start(): Promise<void> {
    if (this.running) {
      if (this.stopRequested) return
      return
    }
    this.stopRequested = false
    this.running = true
    void this.processLoop()
  }

  stop(): void {
    if (!this.running) return
    this.stopRequested = true
    this.emit()
  }

  /** @deprecated 使用 stop */
  pause(): void {
    this.stop()
  }

  async retryMedia(mediaId: string): Promise<void> {
    mediaRepository.setStatus(mediaId, 'pending')
    if (!this.running) await this.start()
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

        const config = configService.load()
        const maxConcurrency = Math.max(1, Math.min(config.llm.maxConcurrency, 16))

        while (inFlight.size < maxConcurrency && this.running && !this.stopRequested) {
          const item = mediaRepository.claimNextPending()
          if (!item) break

          const task = this.processOne(item.id, item.file_path).finally(() => {
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
          if (!mediaRepository.hasPending()) break
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
      this.emit()
    }
  }

  private revertProcessingToPending(): void {
    getDb().prepare(`UPDATE media_items SET analysis_status = 'pending' WHERE analysis_status = 'processing'`).run()
  }

  private async processOne(mediaId: string, filePath: string): Promise<void> {
    const config = configService.load()
    this.processingItems.set(mediaId, filePath)
    this.emit()

    let lastError: Error | null = null
    try {
      for (let attempt = 0; attempt <= config.llm.maxRetries; attempt++) {
        if (this.stopRequested) return
        try {
          const { payload, promptVersion } = await imageAnalyzer.analyzeFile(filePath)
          if (this.stopRequested) return
          this.saveAnalysis(mediaId, payload, config.llm.model, promptVersion)
          mediaRepository.setStatus(mediaId, 'done')
          embeddingService.scheduleIndex(mediaId)
          return
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err))
          await sleep(1000 * (attempt + 1))
        }
      }
      if (!this.stopRequested) {
        console.error(`Analysis failed for ${filePath}:`, lastError)
        mediaRepository.setStatus(mediaId, 'failed')
      }
    } finally {
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
