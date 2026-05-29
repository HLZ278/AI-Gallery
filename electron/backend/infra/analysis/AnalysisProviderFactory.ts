import type { AnalysisMode } from '../../../../shared/types'
import { configService } from '../../services/ConfigService'
import { getModelsCacheDir } from '../../services/LocalModelRegistry'
import { syncReadyMarkersFromCache } from '../../services/LocalModelReady'
import { localModelService } from '../../services/LocalModelService'
import { ollamaRuntimeService } from '../../services/OllamaRuntimeService'
import { usesOllamaCaption } from '../LocalInferenceDevice'
import type { IImageAnalysisProvider } from './IImageAnalysisProvider'
import { cloudImageAnalysisProvider } from './CloudImageAnalysisProvider'
import { localImageAnalysisProvider } from './LocalImageAnalysisProvider'
import { ollamaImageAnalysisProvider } from './OllamaImageAnalysisProvider'

export function createImageAnalysisProvider(mode: AnalysisMode): IImageAnalysisProvider {
  if (mode === 'cloud') return cloudImageAnalysisProvider
  const preference = configService.load().localModels.inferenceDevice
  if (usesOllamaCaption(preference)) return ollamaImageAnalysisProvider
  return localImageAnalysisProvider
}

export async function resolveAnalysisModeForJob(forcedMode?: AnalysisMode): Promise<AnalysisMode> {
  if (forcedMode === 'cloud') {
    const config = configService.load()
    if (!config.llm.apiKey?.trim()) {
      throw new Error('请先在设置中配置 API Key 以使用云端分析')
    }
    return 'cloud'
  }

  if (forcedMode === 'local') {
    return assertLocalAnalysisReady()
  }

  return resolveAnalysisMode()
}

async function assertLocalAnalysisReady(): Promise<'local'> {
  const config = configService.load()
  const modelId = config.analysis.localCaptionModelId

  if (usesOllamaCaption(config.localModels.inferenceDevice)) {
    const status = await ollamaRuntimeService.getStatus()
    if (status.installed && status.running && status.modelReady) return 'local'
    throw new Error(
      `Ollama 视觉模型未就绪（${status.visionModel ?? '未选择'}）。请先配置 Ollama 运行环境，再选择并下载视觉模型。`
    )
  }

  syncReadyMarkersFromCache()
  const ready = await localModelService.isCaptionModelReady()
  if (ready) return 'local'

  throw new Error(
    `本地描述模型未就绪（当前配置: ${modelId}）。请在设置中下载 Qwen 视觉模型与向量模型。`
  )
}

export async function resolveAnalysisMode(requested?: AnalysisMode): Promise<AnalysisMode> {
  const config = configService.load()
  const mode = requested ?? config.analysis.defaultMode
  if (mode === 'cloud') return 'cloud'

  const modelId = config.analysis.localCaptionModelId

  if (usesOllamaCaption(config.localModels.inferenceDevice)) {
    const status = await ollamaRuntimeService.getStatus()
    if (status.installed && status.running && status.modelReady) return 'local'

    console.warn('[Analysis] Ollama caption not ready', {
      modelId,
      visionModel: status.visionModel,
      ollamaModelsDir: status.ollamaModelsDir,
      fallbackEnabled: config.analysis.fallbackToCloudWhenLocalUnavailable,
      hasApiKey: Boolean(config.llm.apiKey?.trim())
    })

    if (config.analysis.fallbackToCloudWhenLocalUnavailable && config.llm.apiKey?.trim()) {
      console.warn('[Analysis] fallback to cloud analysis')
      return 'cloud'
    }

    throw new Error(
      `Ollama 视觉模型未就绪（${status.visionModel ?? '未选择'}）。请先配置 Ollama 运行环境，再选择并下载视觉模型。`
    )
  }

  syncReadyMarkersFromCache()
  const ready = await localModelService.isCaptionModelReady()
  if (ready) return 'local'

  console.warn('[Analysis] local caption model not ready', {
    modelId,
    modelsDir: getModelsCacheDir(),
    fallbackEnabled: config.analysis.fallbackToCloudWhenLocalUnavailable,
    hasApiKey: Boolean(config.llm.apiKey?.trim())
  })

  if (config.analysis.fallbackToCloudWhenLocalUnavailable && config.llm.apiKey?.trim()) {
    console.warn('[Analysis] fallback to cloud analysis')
    return 'cloud'
  }

  throw new Error(
    `本地描述模型未就绪（当前配置: ${modelId}）。请在设置中下载 Qwen 视觉模型与向量模型，或勾选「本地不可用时回退云端」并填写 API Key。`
  )
}
