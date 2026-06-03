import { existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { configService } from './ConfigService'
import {
  findCaptionModel,
  findEmbeddingModel,
  getModelsCacheDir,
  loadLocalModelsRegistry
} from './LocalModelRegistry'
import { getEffectiveRemoteHost } from '../infra/TransformersEnv'
import {
  isModelReadyByMarker,
  isRepoCachedInFilesystem,
  syncReadyMarkersFromCache
} from './LocalModelReady'
import { resolveLocalCaptionPrompt } from '../infra/analysis/LocalCaptionPrompt'
import { usesOllamaCaption } from '../infra/LocalInferenceDevice'
import { isAmdCaptionMode, resolveCaptionOllamaModel } from './CaptionRuntime'
import { ollamaRuntimeService } from './OllamaRuntimeService'
import { localInferenceBridge } from './LocalInferenceBridge'
import type { LocalModelStatus, LocalModelStatusItem, LocalModelsRegistry } from '../../../shared/types'

type PipelineKind = 'caption' | 'embedding'

export class LocalModelService {
  private downloading: { modelId: string; kind: PipelineKind } | null = null
  private downloadProgress = 0
  private downloadMaxProgress = 0
  private downloadError: string | null = null
  private progressListeners: Array<(payload: { modelId: string; progress: number }) => void> = []

  constructor() {
    localInferenceBridge.onDownloadProgress(({ modelId, progress }) => {
      if (this.downloading?.modelId === modelId) {
        this.downloadMaxProgress = Math.max(this.downloadMaxProgress, progress)
        this.downloadProgress = this.downloadMaxProgress
        this.emitProgress(modelId, this.downloadMaxProgress)
      }
    })
  }

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
    const config = configService.load()
    if (usesOllamaCaption(config.localModels.inferenceDevice)) {
      const status = await ollamaRuntimeService.getStatus()
      return status.installed && status.running && status.modelReady
    }

    const id = config.analysis.localCaptionModelId
    const entry = findCaptionModel(id)
    if (!entry) return false
    if (this.isModelCached(id, entry.hfRepo)) return true
    try {
      await localInferenceBridge.start()
      return localInferenceBridge.isCaptionReady(id)
    } catch {
      return false
    }
  }

  async isEmbeddingModelReady(): Promise<boolean> {
    const id = configService.load().embedding.localModelId
    const entry = findEmbeddingModel(id)
    if (!entry) return false
    if (this.isModelCached(id, entry.hfRepo)) return true
    try {
      await localInferenceBridge.start()
      return localInferenceBridge.isEmbeddingReady(id)
    } catch {
      return false
    }
  }

  async getStatus(): Promise<LocalModelStatus> {
    syncReadyMarkersFromCache()
    const registry = loadLocalModelsRegistry()
    const config = configService.load()
    const amdMode = usesOllamaCaption(config.localModels.inferenceDevice)
    const ollamaStatus = amdMode ? await ollamaRuntimeService.getStatus() : undefined
    const items: LocalModelStatusItem[] = []

    for (const m of registry.caption) {
      const isDownloading = this.downloading?.kind === 'caption' && this.downloading.modelId === m.id
      let ready = this.isModelCached(m.id, m.hfRepo)
      if (amdMode && ollamaStatus) {
        ready = ollamaStatus.modelReady
      }
      items.push({
        id: m.id,
        label: m.label,
        kind: 'caption',
        ready,
        downloading: isDownloading,
        progress: isDownloading ? this.downloadProgress : undefined,
        error: isDownloading ? (this.downloadError ?? undefined) : undefined,
        estimatedSizeMb: amdMode ? (m.ollamaEstimatedSizeMb ?? m.estimatedSizeMb) : m.estimatedSizeMb
      })
    }

    for (const m of registry.embedding) {
      const isDownloading = this.downloading?.kind === 'embedding' && this.downloading.modelId === m.id
      items.push({
        id: m.id,
        label: m.label,
        kind: 'embedding',
        ready: this.isModelCached(m.id, m.hfRepo),
        downloading: isDownloading,
        progress: isDownloading ? this.downloadProgress : undefined,
        error: isDownloading ? (this.downloadError ?? undefined) : undefined,
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
      ollamaModelsDir: ollamaStatus?.ollamaModelsDir,
      cacheSizeMb: this.estimateCacheSizeMb(),
      effectiveRemoteHost: getEffectiveRemoteHost(),
      items,
      allReady,
      ollama: ollamaStatus
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

    if (kind === 'caption' && usesOllamaCaption(configService.load().localModels.inferenceDevice)) {
      const modelTag = resolveCaptionOllamaModel(modelId)
      if (!modelTag) throw new Error('未选择 Ollama 视觉模型')

      const runtime = await ollamaRuntimeService.getStatus()
      if (!runtime.runtimeReady) {
        throw new Error('请先点击「配置 Ollama 运行环境」')
      }

      this.downloading = { modelId, kind }
      this.downloadProgress = 0
      this.downloadMaxProgress = 0
      this.downloadError = null
      this.emitProgress(modelId, 0)
      let maxPullProgress = 0
      const unsub = ollamaRuntimeService.onSetupProgress((st) => {
        maxPullProgress = Math.max(maxPullProgress, st.progress)
        this.downloadProgress = maxPullProgress
        this.emitProgress(modelId, maxPullProgress)
      })
      try {
        await ollamaRuntimeService.pullVisionModel(modelTag)
        this.emitProgress(modelId, 100)
      } catch (err) {
        this.downloadError = err instanceof Error ? err.message : String(err)
        throw err
      } finally {
        unsub()
        this.downloading = null
      }
      return
    }

    this.downloading = { modelId, kind }
    this.downloadProgress = 0
    this.downloadMaxProgress = 0
    this.downloadError = null
    this.emitProgress(modelId, 0)

    try {
      console.log('[LocalModel] download start (worker)', { modelId, kind, hfRepo: entry.hfRepo })
      await localInferenceBridge.start()
      await localInferenceBridge.download(modelId, kind)
      console.log('[LocalModel] download done', { modelId, kind, modelsDir: getModelsCacheDir() })
      this.emitProgress(modelId, 100)
    } catch (err) {
      this.downloadError = err instanceof Error ? err.message : String(err)
      console.error('[LocalModel] download failed', { modelId, kind, error: this.downloadError })
      throw err
    } finally {
      this.downloading = null
    }
  }

  cancelDownload(): void {
    this.downloading = null
    this.downloadProgress = 0
    localInferenceBridge.cancelDownload()
  }

  evictCaptionBackends(): void {
    localInferenceBridge.evictCaptionBackends()
  }

  private resolveCaptionPrompt(modelId: string): string {
    const entry = findCaptionModel(modelId)
    if (!entry) throw new Error(`未找到描述模型: ${modelId}`)
    return resolveLocalCaptionPrompt(entry)
  }

  async captionImageFromPath(filePath: string, modelId: string): Promise<string> {
    await localInferenceBridge.start()
    const prompt = this.resolveCaptionPrompt(modelId)
    return localInferenceBridge.captionFromPath(filePath, modelId, prompt)
  }

  async captionImage(buffer: Buffer, modelId: string): Promise<string> {
    await localInferenceBridge.start()
    const prompt = this.resolveCaptionPrompt(modelId)
    return localInferenceBridge.captionFromFrames(modelId, [buffer], prompt)
  }

  async captionImages(frames: Buffer[], modelId: string): Promise<string> {
    await localInferenceBridge.start()
    const prompt = this.resolveCaptionPrompt(modelId)
    return localInferenceBridge.captionFromFrames(modelId, frames, prompt)
  }

  async embedText(text: string, modelId: string): Promise<number[]> {
    await localInferenceBridge.start()
    return localInferenceBridge.embedText(text, modelId)
  }
}

export const localModelService = new LocalModelService()
