import { existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import sharp from 'sharp'
import { configService } from './ConfigService'
import {
  findCaptionModel,
  findEmbeddingModel,
  getModelsCacheDir,
  loadLocalModelsRegistry
} from './LocalModelRegistry'
import {
  applyTransformersEnv,
  applyHfTokenForDownload,
  assertModelDownloadable,
  getEffectiveRemoteHost,
  restoreHfTokenAfterDownload
} from '../infra/TransformersEnv'
import {
  isModelReadyByMarker,
  isRepoCachedInFilesystem,
  markModelReady,
  syncReadyMarkersFromCache
} from './LocalModelReady'
import { isDmlRuntimeInferenceError } from '../infra/LocalInferenceDevice'
import { resolveLocalCaptionPrompt } from '../infra/analysis/LocalCaptionPrompt'
import { QwenVLCaptionEngine } from '../infra/analysis/QwenVLCaptionEngine'
import { isQwenVLPipeline } from '../infra/analysis/QwenVLPipelines'
import type { LocalModelEntry, LocalModelStatus, LocalModelStatusItem, LocalModelsRegistry } from '../../../shared/types'

type PipelineKind = 'caption' | 'embedding'

type CaptionBackend = { engine: QwenVLCaptionEngine; prompt: string }

export class LocalModelService {
  private captionBackends = new Map<string, CaptionBackend>()
  private embeddingPipelines = new Map<string, unknown>()

  /** 推理设备策略变更后丢弃已缓存的 caption 引擎（避免仍占用 DirectML 会话） */
  evictCaptionBackends(): void {
    for (const { engine } of this.captionBackends.values()) {
      engine.dispose()
    }
    this.captionBackends.clear()
  }
  private downloading: { modelId: string; kind: PipelineKind } | null = null
  private downloadProgress = 0
  private downloadError: string | null = null
  private progressListeners: Array<(payload: { modelId: string; progress: number }) => void> = []

  getRegistry(): LocalModelsRegistry {
    return loadLocalModelsRegistry()
  }

  onDownloadProgress(cb: (payload: { modelId: string; progress: number }) => void): () => void {
    this.progressListeners.push(cb)
    return () => {
      this.progressListeners = this.progressListeners.filter((l) => l !== cb)
    }
  }

  private emitProgress(modelId: string, progress: number): void {
    this.downloadProgress = progress
    for (const cb of this.progressListeners) cb({ modelId, progress })
  }

  getCacheDir(): string {
    return getModelsCacheDir()
  }

  isModelCached(modelId: string, hfRepo: string): boolean {
    return isModelReadyByMarker(modelId, hfRepo) || isRepoCachedInFilesystem(hfRepo)
  }

  async isCaptionModelReady(): Promise<boolean> {
    const id = configService.load().analysis.localCaptionModelId
    const entry = findCaptionModel(id)
    if (!entry) return false
    return this.isModelCached(id, entry.hfRepo)
  }

  async isEmbeddingModelReady(): Promise<boolean> {
    const id = configService.load().embedding.localModelId
    const entry = findEmbeddingModel(id)
    if (!entry) return false
    return this.isModelCached(id, entry.hfRepo)
  }

  getStatus(): LocalModelStatus {
    syncReadyMarkersFromCache()
    const registry = loadLocalModelsRegistry()
    const config = configService.load()
    const items: LocalModelStatusItem[] = []

    for (const m of registry.caption) {
      const selected = m.id === config.analysis.localCaptionModelId
      items.push({
        id: m.id,
        label: m.label,
        kind: 'caption',
        ready: this.isModelCached(m.id, m.hfRepo),
        downloading: this.downloading?.kind === 'caption' && this.downloading.modelId === m.id,
        progress: selected && this.downloading?.modelId === m.id ? this.downloadProgress : undefined,
        error: selected ? (this.downloadError ?? undefined) : undefined,
        estimatedSizeMb: m.estimatedSizeMb
      })
    }

    for (const m of registry.embedding) {
      const selected = m.id === config.embedding.localModelId
      items.push({
        id: m.id,
        label: m.label,
        kind: 'embedding',
        ready: this.isModelCached(m.id, m.hfRepo),
        downloading: this.downloading?.kind === 'embedding' && this.downloading.modelId === m.id,
        progress: selected && this.downloading?.modelId === m.id ? this.downloadProgress : undefined,
        error: selected ? (this.downloadError ?? undefined) : undefined,
        estimatedSizeMb: m.estimatedSizeMb
      })
    }

    const requiredCaption = config.analysis.defaultMode === 'local'
    const requiredEmbed = config.embedding.provider === 'local' && config.embedding.enabled
    const captionReady = items.filter((i) => i.kind === 'caption').some((i) => i.id === config.analysis.localCaptionModelId && i.ready)
    const embedReady = items.filter((i) => i.kind === 'embedding').some((i) => i.id === config.embedding.localModelId && i.ready)
    const allReady = (!requiredCaption || captionReady) && (!requiredEmbed || embedReady)

    return {
      modelsDir: getModelsCacheDir(),
      cacheSizeMb: this.estimateCacheSizeMb(),
      effectiveRemoteHost: getEffectiveRemoteHost(),
      items,
      allReady
    }
  }

  private estimateCacheSizeMb(): number {
    const dir = getModelsCacheDir()
    if (!existsSync(dir)) return 0
    let total = 0
    const walk = (path: string) => {
      try {
        for (const name of readdirSync(path)) {
          const full = join(path, name)
          const st = statSync(full)
          if (st.isDirectory()) walk(full)
          else total += st.size
        }
      } catch {
        /* ignore */
      }
    }
    walk(dir)
    return Math.round((total / 1024 / 1024) * 10) / 10
  }

  async download(modelId: string, kind: PipelineKind): Promise<void> {
    if (this.downloading) throw new Error('已有模型正在下载')
    const entry = kind === 'caption' ? findCaptionModel(modelId) : findEmbeddingModel(modelId)
    if (!entry) throw new Error(`未知模型: ${modelId}`)

    this.downloading = { modelId, kind }
    this.downloadProgress = 0
    this.downloadError = null
    this.emitProgress(modelId, 0)

    try {
      console.log('[LocalModel] download start', { modelId, kind, hfRepo: entry.hfRepo })
      await applyTransformersEnv()
      await assertModelDownloadable(modelId, kind)
      applyHfTokenForDownload()

      const { pipeline } = await import('@huggingface/transformers')
      const cacheDir = getModelsCacheDir()
      const progress_callback = (info: { status?: string; file?: string; progress?: number }) => {
        if (info.file || info.status) {
          console.log('[LocalModel] progress', { modelId, status: info.status, file: info.file, progress: info.progress })
        }
        if (typeof info.progress === 'number') {
          this.emitProgress(modelId, Math.round(info.progress))
        }
      }

      if (kind === 'caption') {
        await this.warmupCaptionModel(entry, progress_callback)
        this.captionBackends.delete(modelId)
      } else {
        await pipeline(entry.pipeline as 'feature-extraction', entry.hfRepo, {
          cache_dir: cacheDir,
          progress_callback
        })
        this.embeddingPipelines.delete(modelId)
      }
      markModelReady(modelId, entry.hfRepo)
      console.log('[LocalModel] download done', { modelId, kind, modelsDir: getModelsCacheDir() })
      this.emitProgress(modelId, 100)
    } catch (err) {
      this.downloadError = err instanceof Error ? err.message : String(err)
      console.error('[LocalModel] download failed', { modelId, kind, error: this.downloadError })
      throw err
    } finally {
      restoreHfTokenAfterDownload()
      this.downloading = null
    }
  }

  cancelDownload(): void {
    this.downloading = null
    this.downloadProgress = 0
  }

  private async warmupCaptionModel(
    entry: LocalModelEntry,
    progress_callback?: (info: { progress?: number; status?: string; file?: string }) => void
  ): Promise<void> {
    if (!isQwenVLPipeline(entry.pipeline)) {
      throw new Error(`不支持的本地描述 pipeline: ${entry.pipeline}`)
    }
    const engine = new QwenVLCaptionEngine()
    await engine.load(entry, progress_callback)
    engine.dispose()
  }

  private async getCaptionBackend(modelId: string): Promise<CaptionBackend> {
    const cached = this.captionBackends.get(modelId)
    if (cached) return cached

    const entry = findCaptionModel(modelId)
    if (!entry) throw new Error(`未找到描述模型: ${modelId}`)
    if (!isQwenVLPipeline(entry.pipeline)) {
      throw new Error(`不支持的本地描述 pipeline: ${entry.pipeline}`)
    }

    const prompt = resolveLocalCaptionPrompt(entry)
    const engine = new QwenVLCaptionEngine()
    await engine.load(entry)
    const backend: CaptionBackend = { engine, prompt }
    this.captionBackends.set(modelId, backend)
    return backend
  }

  private async getEmbeddingPipeline(modelId: string) {
    const cached = this.embeddingPipelines.get(modelId)
    if (cached) return cached
    const entry = findEmbeddingModel(modelId)
    if (!entry) throw new Error(`未找到向量模型: ${modelId}`)
    await applyTransformersEnv()
    const { pipeline } = await import('@huggingface/transformers')
    const pipe = await pipeline('feature-extraction', entry.hfRepo, {
      cache_dir: getModelsCacheDir(),
      device: 'cpu'
    })
    this.embeddingPipelines.set(modelId, pipe)
    return pipe
  }

  async captionImageFromPath(filePath: string, modelId: string): Promise<string> {
    const { RawImage } = await import('@huggingface/transformers')
    const image = await RawImage.read(filePath)
    return this.runCaptionPipeline(image, modelId)
  }

  async captionImage(buffer: Buffer, modelId: string): Promise<string> {
    const image = await this.bufferToRawImage(buffer)
    return this.runCaptionPipeline(image, modelId)
  }

  private async bufferToRawImage(buffer: Buffer) {
    const { RawImage } = await import('@huggingface/transformers')
    const img = sharp(buffer).rotate()
    const metadata = await img.metadata()
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true })
    const channels = info.channels as 1 | 2 | 3 | 4
    const image = new RawImage(new Uint8ClampedArray(data), info.width, info.height, channels)
    if (metadata.channels !== undefined && metadata.channels !== info.channels) {
      image.convert(metadata.channels)
    }
    return image
  }

  private async runCaptionPipeline(image: unknown, modelId: string): Promise<string> {
    const backend = await this.getCaptionBackend(modelId)
    try {
      return await backend.engine.caption(image, backend.prompt)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('未加载') || msg.includes('回退加载失败') || isDmlRuntimeInferenceError(err)) {
        this.captionBackends.delete(modelId)
      }
      throw err
    }
  }

  async embedText(text: string, modelId: string): Promise<number[]> {
    const pipe = (await this.getEmbeddingPipeline(modelId)) as (
      input: string,
      opts?: { pooling?: string; normalize?: boolean }
    ) => Promise<{ data: Float32Array | number[] }>

    const output = await pipe(text, { pooling: 'mean', normalize: true })
    const data = output?.data
    if (!data) throw new Error('Empty local embedding')
    return Array.from(data instanceof Float32Array ? data : (data as number[]))
  }
}

export const localModelService = new LocalModelService()
