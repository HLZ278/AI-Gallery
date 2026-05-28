import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import type { LocalModelEntry, LocalModelsRegistry } from '../../../shared/types'

export { getModelsCacheDir } from '../infra/AppPaths'

export function resolveRegistryPath(): string {
  const fromEnv = process.env.PICTURESEARCH_REGISTRY_PATH?.trim()
  if (fromEnv && existsSync(fromEnv)) return fromEnv
  let appPath = process.cwd()
  try {
    const { app } = require('electron') as typeof import('electron')
    if (app?.getAppPath) appPath = app.getAppPath()
  } catch {
    /* inference worker */
  }
  const paths = [
    join(appPath, 'config/local-models.json'),
    join(__dirname, '../../config/local-models.json'),
    join(process.cwd(), 'config/local-models.json')
  ]
  for (const p of paths) {
    if (existsSync(p)) return p
  }
  throw new Error('local-models.json not found')
}

let cached: LocalModelsRegistry | null = null

export function loadLocalModelsRegistry(): LocalModelsRegistry {
  if (cached) return cached
  const raw = readFileSync(resolveRegistryPath(), 'utf-8')
  cached = JSON.parse(raw) as LocalModelsRegistry
  return cached
}

export function findCaptionModel(id: string): LocalModelEntry | undefined {
  return loadLocalModelsRegistry().caption.find((m) => m.id === id)
}

export function findEmbeddingModel(id: string): LocalModelEntry | undefined {
  return loadLocalModelsRegistry().embedding.find((m) => m.id === id)
}
