import type { AnalysisMode } from '../../../../shared/types'
import { configService } from '../../services/ConfigService'
import { getModelsCacheDir } from '../../services/LocalModelRegistry'
import { syncReadyMarkersFromCache } from '../../services/LocalModelReady'
import { localModelService } from '../../services/LocalModelService'
import type { IImageAnalysisProvider } from './IImageAnalysisProvider'
import { cloudImageAnalysisProvider } from './CloudImageAnalysisProvider'
import { localImageAnalysisProvider } from './LocalImageAnalysisProvider'

export function createImageAnalysisProvider(mode: AnalysisMode): IImageAnalysisProvider {
  if (mode === 'cloud') return cloudImageAnalysisProvider
  return localImageAnalysisProvider
}

export async function resolveAnalysisMode(requested?: AnalysisMode): Promise<AnalysisMode> {
  const config = configService.load()
  const mode = requested ?? config.analysis.defaultMode
  if (mode === 'cloud') return 'cloud'

  const modelId = config.analysis.localCaptionModelId
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
