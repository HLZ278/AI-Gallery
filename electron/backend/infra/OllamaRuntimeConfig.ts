import { readFileSync } from 'fs'
import { resolveBundledConfigPath } from './AppPaths'

import type { OllamaVisionModelEntry } from '../../../shared/types'

export interface OllamaRuntimeConfig {
  baseUrl: string
  modelsSubdir: string
  timeoutMs: number
  visionModelAliases?: Record<string, string>
  chatRequest?: {
    think?: boolean
    defaultNumPredict?: number
  }
  visionModels: OllamaVisionModelEntry[]
  installer: {
    downloadUrl: string
    silentArgs: string[]
  }
  installDirEnv: string
  installRelativePath: string
  gpuEnv: Record<string, string>
  serveStartupWaitMs: number
  installPollIntervalMs: number
  installPollMaxAttempts: number
}

let cached: OllamaRuntimeConfig | null = null

export function loadOllamaRuntimeConfig(): OllamaRuntimeConfig {
  if (cached) return cached
  cached = JSON.parse(readFileSync(resolveBundledConfigPath('ollama-runtime.json'), 'utf-8')) as OllamaRuntimeConfig
  return cached
}

export function resetOllamaRuntimeConfigCache(): void {
  cached = null
}

export function loadOllamaVisionCatalog(): OllamaVisionModelEntry[] {
  return loadOllamaRuntimeConfig().visionModels ?? []
}

export function getDefaultOllamaVisionModelTag(): string {
  const catalog = loadOllamaVisionCatalog()
  return catalog.find((m) => m.recommended)?.tag ?? catalog[0]?.tag ?? ''
}

/** 将旧版 tag（如 qwen3-vl:2b）映射到 instruct 变体，配置见 ollama-runtime.json */
export function resolveVisionModelTag(tag: string): string {
  const trimmed = tag.trim()
  if (!trimmed) return trimmed
  const aliases = loadOllamaRuntimeConfig().visionModelAliases ?? {}
  return aliases[trimmed] ?? trimmed
}
