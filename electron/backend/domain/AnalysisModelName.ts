import type { AnalysisMode } from '../../../shared/types'
import { configService } from '../services/ConfigService'

export function buildAnalysisModelName(mode: AnalysisMode, localCaptionModelId?: string): string {
  if (mode === 'cloud') {
    return `cloud/${configService.load().llm.model}`
  }
  const id = localCaptionModelId ?? configService.load().analysis.localCaptionModelId
  return `local/${id}`
}

export function buildEmbeddingModelName(): string {
  const config = configService.load()
  if (config.embedding.provider === 'local') {
    return `local/${config.embedding.localModelId}`
  }
  return `cloud/${config.embedding.model}`
}

export function isCloudAnalysisModel(modelName: string): boolean {
  return modelName.startsWith('cloud/')
}

export function isLocalAnalysisModel(modelName: string): boolean {
  return modelName.startsWith('local/')
}
