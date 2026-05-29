import { configService } from './ConfigService'
import {
  getDefaultOllamaVisionModelTag,
  loadOllamaVisionCatalog,
  resolveVisionModelTag
} from '../infra/OllamaRuntimeConfig'
import { usesOllamaCaption } from '../infra/LocalInferenceDevice'
import { findCaptionModel } from './LocalModelRegistry'

export function resolveCaptionOllamaModel(modelId?: string): string | null {
  const config = configService.load()
  const fromConfig = config.localModels.ollamaVisionModelTag?.trim()
  if (fromConfig) return resolveVisionModelTag(fromConfig)

  const id = modelId ?? config.analysis.localCaptionModelId
  const entry = findCaptionModel(id)
  const fallback = entry?.ollamaModel?.trim() || getDefaultOllamaVisionModelTag()
  return fallback ? resolveVisionModelTag(fallback) : null
}

export function isAmdCaptionMode(): boolean {
  return usesOllamaCaption(configService.load().localModels.inferenceDevice)
}

export function listOllamaVisionCatalog() {
  return loadOllamaVisionCatalog()
}
