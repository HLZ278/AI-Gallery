import { existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import sharp from 'sharp'
import type { AppConfig, LocalModelEntry } from '../../../shared/types'
import { setWorkerActiveConfig, getActiveConfig } from '../infra/ActiveConfig'
import {
  applyTransformersEnv,
  applyHfTokenForDownload,
  assertModelDownloadable,
  restoreHfTokenAfterDownload
} from '../infra/TransformersEnv'
import {
  buildInferenceDeviceLoadError,
  inferenceDeviceCandidates,
  isGpuRuntimeInferenceError,
  logInferenceDevice,
  resolveInferenceDevicePreference,
  toTransformersOnnxDevice
} from '../infra/LocalInferenceDevice'
import { QwenVLCaptionEngine } from '../infra/analysis/QwenVLCaptionEngine'
import { isQwenVLPipeline } from '../infra/analysis/QwenVLPipelines'
import {
  findCaptionModel,
  findEmbeddingModel,
  getModelsCacheDir,
  loadLocalModelsRegistry
} from '../services/LocalModelRegistry'
import {
  isModelReadyByMarker,
  isRepoCachedInFilesystem,
  markModelReady
} from '../services/LocalModelReady'
import type {
  WorkerCaptionFromFramesPayload,
  WorkerCaptionFromPathPayload,
  WorkerDownloadPayload,
  WorkerEmbedPayload,
  WorkerInitPayload
} from './LocalInferenceProtocol'

type PipelineKind = 'caption' | 'embedding'
type CaptionBackend = { engine: QwenVLCaptionEngine; prompt: string }

function buildWorkerAppConfig(payload: WorkerInitPayload): AppConfig {
  return JSON.parse(payload.configJson) as AppConfig
}

export class LocalInferenceWorkerRuntime {
  private initialized = false
  private captionBackends = new Map<string, CaptionBackend>()
  private embeddingPipelines = new Map<string, unknown>()
  private downloading: { modelId: string; kind: PipelineKind } | null = null
  private chain: Promise<unknown> = Promise.resolve()
  private onProgress: ((modelId: string, progress: number) => void) | null = null

  setProgressHandler(handler: (modelId: string, progress: number) => void): void {
    this.onProgress = handler
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn)
    this.chain = run.then(
      () => undefined,
      () => undefined
    )
    return run
  }

  private emitProgress(modelId: string, progress: number): void {
    this.onProgress?.(modelId, progress)
  }

  async init(payload: WorkerInitPayload): Promise<void> {
    process.env.PICTURESEARCH_INFERENCE_WORKER = '1'
    process.env.PICTURESEARCH_MODELS_DIR = payload.modelsCacheDir
    process.env.PICTURESEARCH_REGISTRY_PATH = payload.registryPath
    process.env.PICTURESEARCH_PROMPTS_DIR = payload.promptsDir
    process.env.PICTURESEARCH_APP_ROOT = payload.appRoot

    setWorkerActiveConfig(buildWorkerAppConfig(payload))
    await applyTransformersEnv()
    this.initialized = true
  }

  private assertInit(): void {
    if (!this.initialized) throw new Error('推理子进程未初始化')
  }

  isModelCached(modelId: string, hfRepo: string): boolean {
    return isModelReadyByMarker(modelId, hfRepo) || isRepoCachedInFilesystem(hfRepo)
  }

  async isCaptionReady(modelId: string): Promise<boolean> {
    const entry = findCaptionModel(modelId)
    if (!entry) return false
    return this.isModelCached(modelId, entry.hfRepo)
  }

  async isEmbeddingReady(modelId: string): Promise<boolean> {
    const entry = findEmbeddingModel(modelId)
    if (!entry) return false
    return this.isModelCached(modelId, entry.hfRepo)
  }

  evictCaptionBackends(): void {
    for (const { engine } of this.captionBackends.values()) {
      engine.dispose()
    }
    this.captionBackends.clear()
  }

  async captionFromPath(payload: WorkerCaptionFromPathPayload): Promise<string> {
    this.assertInit()
    return this.enqueue(async () => {
      const { RawImage } = await import('@huggingface/transformers')
      const image = await RawImage.read(payload.filePath)
      return this.runCaption(image, payload.modelId, payload.prompt)
    })
  }

  async captionFromFrames(payload: WorkerCaptionFromFramesPayload): Promise<string> {
    this.assertInit()
    return this.enqueue(async () => {
      const captions: string[] = []
      for (const b64 of payload.frames) {
        const buffer = Buffer.from(b64, 'base64')
        captions.push(await this.captionFromBuffer(buffer, payload.modelId, payload.prompt))
      }
      return captions.filter(Boolean).join('\n')
    })
  }

  private async captionFromBuffer(buffer: Buffer, modelId: string, prompt: string): Promise<string> {
    const image = await this.bufferToRawImage(buffer)
    return this.runCaption(image, modelId, prompt)
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

  private async runCaption(image: unknown, modelId: string, prompt: string): Promise<string> {
    const backend = await this.getCaptionBackend(modelId, prompt)
    try {
      return await backend.engine.caption(image, backend.prompt)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (
        msg.includes('未加载') ||
        msg.includes('回退加载失败') ||
        msg.includes('本地推理设备') ||
        isGpuRuntimeInferenceError(err)
      ) {
        this.captionBackends.clear()
      }
      throw err
    }
  }

  private async getCaptionBackend(modelId: string, prompt: string): Promise<CaptionBackend> {
    const cacheKey = `${modelId}:${prompt.length}`
    const cached = this.captionBackends.get(cacheKey)
    if (cached) return cached

    const entry = findCaptionModel(modelId)
    if (!entry) throw new Error(`未找到描述模型: ${modelId}`)
    if (!isQwenVLPipeline(entry.pipeline)) {
      throw new Error(`不支持的本地描述 pipeline: ${entry.pipeline}`)
    }

    const engine = new QwenVLCaptionEngine()
    await engine.load(entry)
    const backend: CaptionBackend = { engine, prompt }
    this.captionBackends.set(cacheKey, backend)
    return backend
  }

  async embed(payload: WorkerEmbedPayload): Promise<number[]> {
    this.assertInit()
    return this.enqueue(async () => {
      const pipe = (await this.getEmbeddingPipeline(payload.modelId)) as (
        input: string,
        opts?: { pooling?: string; normalize?: boolean }
      ) => Promise<{ data: Float32Array | number[] }>

      const output = await pipe(payload.text.slice(0, 8000), { pooling: 'mean', normalize: true })
      const data = output?.data
      if (!data) throw new Error('Empty local embedding')
      return Array.from(data instanceof Float32Array ? data : (data as number[]))
    })
  }

  async download(payload: WorkerDownloadPayload): Promise<void> {
    this.assertInit()
    return this.enqueue(async () => {
      if (this.downloading) throw new Error('已有模型正在下载')
      const entry =
        payload.kind === 'caption'
          ? findCaptionModel(payload.modelId)
          : findEmbeddingModel(payload.modelId)
      if (!entry) throw new Error(`未知模型: ${payload.modelId}`)

      this.downloading = { modelId: payload.modelId, kind: payload.kind }
      this.emitProgress(payload.modelId, 0)

      try {
        await applyTransformersEnv()
        await assertModelDownloadable(payload.modelId, payload.kind)
        applyHfTokenForDownload()

        const { pipeline } = await import('@huggingface/transformers')
        const cacheDir = getModelsCacheDir()
        const progress_callback = (info: { status?: string; file?: string; progress?: number }) => {
          if (typeof info.progress === 'number') {
            this.emitProgress(payload.modelId, Math.round(info.progress))
          }
        }

        if (payload.kind === 'caption') {
          await this.warmupCaptionModel(entry, progress_callback)
          for (const key of [...this.captionBackends.keys()]) {
            if (key.startsWith(`${payload.modelId}:`)) this.captionBackends.delete(key)
          }
        } else {
          await pipeline(entry.pipeline as 'feature-extraction', entry.hfRepo, {
            cache_dir: cacheDir,
            device: 'cpu',
            progress_callback
          })
          this.embeddingPipelines.delete(payload.modelId)
        }
        markModelReady(payload.modelId, entry.hfRepo)
        this.emitProgress(payload.modelId, 100)
      } finally {
        restoreHfTokenAfterDownload()
        this.downloading = null
      }
    })
  }

  cancelDownload(): void {
    this.downloading = null
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

  private async getEmbeddingPipeline(modelId: string) {
    const cached = this.embeddingPipelines.get(modelId)
    if (cached) return cached
    const entry = findEmbeddingModel(modelId)
    if (!entry) throw new Error(`未找到向量模型: ${modelId}`)

    const preference = getActiveConfig().localModels.inferenceDevice
    const candidates = inferenceDeviceCandidates(preference)
    await applyTransformersEnv()
    const { pipeline } = await import('@huggingface/transformers')
    const cacheDir = getModelsCacheDir()

    let lastError: unknown
    let lastDevice = resolveInferenceDevicePreference(preference)
    for (const device of candidates) {
      lastDevice = device
      const onnxDevice = toTransformersOnnxDevice(device)
      try {
        logInferenceDevice('loading embedding pipeline', { modelId, device: onnxDevice })
        const pipe = await pipeline(entry.pipeline as 'feature-extraction', entry.hfRepo, {
          cache_dir: cacheDir,
          device: onnxDevice
        })
        this.embeddingPipelines.set(modelId, pipe)
        logInferenceDevice('embedding pipeline ready', { modelId, device: onnxDevice })
        return pipe
      } catch (err) {
        lastError = err
        logInferenceDevice('embedding load failed', {
          modelId,
          device: onnxDevice,
          error: err instanceof Error ? err.message : String(err)
        })
        throw buildInferenceDeviceLoadError(preference, device, err)
      }
    }
    throw buildInferenceDeviceLoadError(preference, lastDevice, lastError)
  }

  shutdown(): void {
    this.evictCaptionBackends()
    this.embeddingPipelines.clear()
    this.initialized = false
  }

  estimateCacheSizeMb(): number {
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
}
