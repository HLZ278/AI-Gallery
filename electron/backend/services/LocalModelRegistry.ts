import { app } from 'electron'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import type { LocalModelEntry, LocalModelsRegistry } from '../../../shared/types'

export { getModelsCacheDir } from '../infra/AppPaths'

function getRegistryPath(): string {
  const paths = [
    join(app.getAppPath(), 'config/local-models.json'),
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
  const raw = readFileSync(getRegistryPath(), 'utf-8')
  cached = JSON.parse(raw) as LocalModelsRegistry
  return cached
}

export function findCaptionModel(id: string): LocalModelEntry | undefined {
  return loadLocalModelsRegistry().caption.find((m) => m.id === id)
}

export function findEmbeddingModel(id: string): LocalModelEntry | undefined {
  return loadLocalModelsRegistry().embedding.find((m) => m.id === id)
}
