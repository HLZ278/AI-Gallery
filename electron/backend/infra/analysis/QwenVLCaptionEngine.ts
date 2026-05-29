import { getActiveConfig } from '../ActiveConfig'
import { getModelsCacheDir } from '../../services/LocalModelRegistry'
import { applyTransformersEnv } from '../TransformersEnv'
import {
  buildInferenceDeviceLoadError,
  buildInferenceDeviceRuntimeError,
  inferenceDeviceCandidates,
  isGpuRuntimeInferenceError,
  logInferenceDevice,
  toTransformersOnnxDevice,
  type ResolvedInferenceDevice
} from '../LocalInferenceDevice'
import type { LocalModelEntry } from '../../../../shared/types'
import {
  DEFAULT_QWEN_VL_DTYPE,
  isQwenVLPipeline,
  loadQwenVLModelClass,
  type QwenVLDtypeConfig,
  type QwenVLPipelineId
} from './QwenVLPipelines'

const DEFAULT_IMAGE_EDGE = 448

export interface QwenVLLoadOptions {
  pipeline: string
  maxNewTokens?: number
  imageEdge?: number
  dtype?: QwenVLDtypeConfig
}

type ChatMessage = {
  role: string
  content: Array<{ type: string; text?: string }>
}

export class QwenVLCaptionEngine {
  private loadedKey: string | null = null
  private processor: unknown = null
  private model: unknown = null
  private pipeline: QwenVLPipelineId = 'qwen3-vl'
  private imageEdge = DEFAULT_IMAGE_EDGE
  private maxNewTokens = 512
  private resolvedDevice: ResolvedInferenceDevice = 'cpu'
  private lastEntry: LocalModelEntry | null = null

  private buildLoadKey(hfRepo: string, pipeline: QwenVLPipelineId, device: ResolvedInferenceDevice): string {
    return `${pipeline}:${hfRepo}:${device}`
  }

  async load(
    entry: LocalModelEntry,
    progress_callback?: (info: { progress?: number; status?: string; file?: string }) => void
  ): Promise<void> {
    if (!isQwenVLPipeline(entry.pipeline)) {
      throw new Error(`不支持的 Qwen VL pipeline: ${entry.pipeline}`)
    }
    const pipeline = entry.pipeline
    const preference = getActiveConfig().localModels.inferenceDevice
    const candidates = inferenceDeviceCandidates(preference)
    const dtype = entry.dtype ?? DEFAULT_QWEN_VL_DTYPE
    this.pipeline = pipeline
    this.imageEdge = entry.imageEdge ?? DEFAULT_IMAGE_EDGE
    this.maxNewTokens = entry.maxNewTokens ?? 512
    this.lastEntry = entry

    let lastError: unknown
    let lastDevice: ResolvedInferenceDevice = 'cpu'
    for (const device of candidates) {
      lastDevice = device
      const loadKey = this.buildLoadKey(entry.hfRepo, pipeline, device)
      if (this.loadedKey === loadKey && this.model) return

      try {
        await applyTransformersEnv()
        const { AutoProcessor } = await import('@huggingface/transformers')
        const ModelClass = await loadQwenVLModelClass(pipeline)
        const cacheDir = getModelsCacheDir()
        const onnxDevice = toTransformersOnnxDevice(device)
        const opts = { cache_dir: cacheDir, progress_callback, device: onnxDevice }

        logInferenceDevice('loading model', { pipeline, hfRepo: entry.hfRepo, device: onnxDevice })
        this.processor = await AutoProcessor.from_pretrained(entry.hfRepo, opts)
        this.model = await ModelClass.from_pretrained(entry.hfRepo, { ...opts, dtype })
        this.resolvedDevice = device
        this.loadedKey = loadKey
        logInferenceDevice('model ready', { device })
        return
      } catch (err) {
        lastError = err
        logInferenceDevice('load failed', {
          device,
          error: err instanceof Error ? err.message : String(err)
        })
        this.processor = null
        this.model = null
        this.loadedKey = null
        throw buildInferenceDeviceLoadError(preference, device, err)
      }
    }
    throw buildInferenceDeviceLoadError(preference, lastDevice, lastError)
  }

  private async prepareImage(image: unknown): Promise<unknown> {
    if (!image || typeof image !== 'object' || !('resize' in image)) return image
    const resizable = image as { resize: (w: number, h: number) => Promise<unknown> }
    return resizable.resize(this.imageEdge, this.imageEdge)
  }

  private async runCaption(image: unknown, prompt: string): Promise<string> {
    const processor = this.processor as {
      apply_chat_template: (
        messages: ChatMessage[],
        opts: { add_generation_prompt: boolean }
      ) => string
      (text: string, img: unknown): Promise<{
        input_ids: { dims: number[] }
      }>
      batch_decode: (tensor: unknown, opts: { skip_special_tokens: boolean }) => string[]
    }
    const model = this.model as {
      generate: (inputs: Record<string, unknown>) => Promise<{ slice: (a: null, b: [number, null]) => unknown }>
    }

    const img = await this.prepareImage(image)
    const conversation: ChatMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'image' },
          { type: 'text', text: prompt }
        ]
      }
    ]

    const text = processor.apply_chat_template(conversation, { add_generation_prompt: true })
    const inputs = await processor(text, img)
    const inputLen = inputs.input_ids.dims.at(-1) ?? 0

    const outputs = await model.generate({
      ...inputs,
      max_new_tokens: this.maxNewTokens,
      do_sample: false
    })

    const decoded = processor.batch_decode(outputs.slice(null, [inputLen, null]), {
      skip_special_tokens: true
    })
    return (decoded[0] ?? '').trim()
  }

  async caption(image: unknown, prompt: string): Promise<string> {
    if (!this.model || !this.processor) {
      throw new Error('Qwen VL 模型未加载')
    }
    const instruction = prompt.trim()
    if (!instruction) {
      throw new Error('Qwen VL 分析提示词为空')
    }

    const preference = getActiveConfig().localModels.inferenceDevice
    try {
      return await this.runCaption(image, instruction)
    } catch (err) {
      if (this.resolvedDevice !== 'cpu' && isGpuRuntimeInferenceError(err)) {
        throw buildInferenceDeviceRuntimeError(preference, this.resolvedDevice, err)
      }
      throw err
    }
  }

  private clearLoadedModels(): void {
    this.processor = null
    this.model = null
    this.loadedKey = null
  }

  dispose(): void {
    this.clearLoadedModels()
    this.lastEntry = null
  }
}
