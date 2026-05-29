import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'fs'
import { join } from 'path'
import type { AppConfig } from '../../../shared/types'
import { getDefaultOllamaVisionModelTag, resolveVisionModelTag } from '../infra/OllamaRuntimeConfig'
import { loadLocalModelsRegistry } from './LocalModelRegistry'

const CONFIG_FILENAME = 'config.json'

function getConfigDir(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function getDefaultConfigPath(): string {
  const paths = [
    join(app.getAppPath(), 'config/default.config.json'),
    join(__dirname, '../../config/default.config.json'),
    join(process.cwd(), 'config/default.config.json')
  ]
  for (const p of paths) {
    if (existsSync(p)) return p
  }
  throw new Error('Default config not found')
}

function deepMerge<T extends Record<string, unknown>>(base: T, override: Partial<T>): T {
  const result = { ...base }
  for (const key of Object.keys(override) as (keyof T)[]) {
    const val = override[key]
    if (val && typeof val === 'object' && !Array.isArray(val) && base[key]) {
      result[key] = deepMerge(base[key] as Record<string, unknown>, val as Record<string, unknown>) as T[keyof T]
    } else if (val !== undefined) {
      result[key] = val as T[keyof T]
    }
  }
  return result
}

function migrateAppConfig(config: AppConfig): AppConfig {
  const legacyCaptionIds = [
    'blip-caption',
    'moondream2-caption',
    'vit-gpt2-caption',
    'qwen2-vl-2b-caption'
  ]
  const caption = loadLocalModelsRegistry().caption
  const defaultCaptionId =
    caption.find((m) => m.recommended)?.id ?? caption[0]?.id ?? 'qwen3-vl-2b-caption'
  if (legacyCaptionIds.includes(config.analysis.localCaptionModelId)) {
    config.analysis.localCaptionModelId = defaultCaptionId
  }
  if (!caption.some((m) => m.id === config.analysis.localCaptionModelId)) {
    config.analysis.localCaptionModelId = defaultCaptionId
  }
  if (!config.localModels) {
    config.localModels = {
      remoteHost: '',
      remotePathTemplate: '',
      hfToken: '',
      ignoreEnvHfToken: true,
      inferenceDevice: 'wasm',
      ollamaVisionModelTag: getDefaultOllamaVisionModelTag()
    }
  }
  if (!config.localModels.inferenceDevice) {
    config.localModels.inferenceDevice = 'wasm'
  }
  const legacyDevice = config.localModels.inferenceDevice as string
  if (legacyDevice === 'auto' || legacyDevice === 'dml') {
    config.localModels.inferenceDevice = 'wasm'
  }
  if (!config.localModels.ollamaVisionModelTag?.trim()) {
    config.localModels.ollamaVisionModelTag = getDefaultOllamaVisionModelTag()
  } else {
    config.localModels.ollamaVisionModelTag = resolveVisionModelTag(config.localModels.ollamaVisionModelTag)
  }
  return config
}

export class ConfigService {
  private config: AppConfig | null = null

  getDefaults(): AppConfig {
    const raw = readFileSync(getDefaultConfigPath(), 'utf-8')
    return JSON.parse(raw) as AppConfig
  }

  getConfigPath(): string {
    return join(getConfigDir(), CONFIG_FILENAME)
  }

  load(): AppConfig {
    if (this.config) return this.config
    const defaults = this.getDefaults()
    const configPath = this.getConfigPath()
    if (!existsSync(configPath)) {
      copyFileSync(getDefaultConfigPath(), configPath)
      this.config = defaults
      return defaults
    }
    const userConfig = JSON.parse(readFileSync(configPath, 'utf-8')) as Partial<AppConfig>
    this.config = migrateAppConfig(deepMerge(defaults, userConfig))
    return this.config
  }

  save(config: AppConfig): void {
    writeFileSync(this.getConfigPath(), JSON.stringify(config, null, 2), 'utf-8')
    this.config = config
  }

  reload(): AppConfig {
    this.config = null
    return this.load()
  }
}

export const configService = new ConfigService()
