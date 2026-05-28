import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { join } from 'path'
import { getModelsCacheDir, loadLocalModelsRegistry } from './LocalModelRegistry'

const MARKER_PREFIX = '.ready-'

export function getModelReadyMarkerPath(modelId: string): string {
  return join(getModelsCacheDir(), `${MARKER_PREFIX}${modelId}`)
}

export function markModelReady(modelId: string, hfRepo: string): void {
  const dir = getModelsCacheDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(getModelReadyMarkerPath(modelId), hfRepo, 'utf-8')
}

export function isModelReadyByMarker(modelId: string, expectedHfRepo: string): boolean {
  const marker = getModelReadyMarkerPath(modelId)
  if (!existsSync(marker)) return false
  try {
    return readFileSync(marker, 'utf-8').trim() === expectedHfRepo
  } catch {
    return false
  }
}

const CACHE_MARKERS = ['tokenizer.json', 'config.json', 'preprocessor_config.json', 'model.onnx', 'decoder_model_merged.onnx']

export function isRepoCachedInFilesystem(hfRepo: string): boolean {
  const cacheDir = getModelsCacheDir()
  if (!existsSync(cacheDir)) return false

  const repoToken = hfRepo.replace(/\//g, '--')
  const hubDir = join(cacheDir, `models--${repoToken}`)
  if (existsSync(hubDir) && dirContainsModelArtifact(hubDir)) return true

  return walkCacheForRepo(cacheDir, repoToken)
}

function dirContainsModelArtifact(dir: string, depth = 0): boolean {
  if (depth > 12) return false
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return false
  }
  for (const name of entries) {
    const full = join(dir, name)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isFile()) {
      if (CACHE_MARKERS.includes(name) || name.endsWith('.onnx')) return true
    } else if (st.isDirectory() && dirContainsModelArtifact(full, depth + 1)) {
      return true
    }
  }
  return false
}

function walkCacheForRepo(root: string, repoToken: string, depth = 0): boolean {
  if (depth > 8) return false
  let entries: string[]
  try {
    entries = readdirSync(root)
  } catch {
    return false
  }
  for (const name of entries) {
    if (!name.includes(repoToken) && !name.replace('models--', '').includes(repoToken)) continue
    const full = join(root, name)
    try {
      if (statSync(full).isDirectory() && dirContainsModelArtifact(full)) return true
    } catch {
      continue
    }
  }
  for (const name of entries) {
    const full = join(root, name)
    try {
      if (statSync(full).isDirectory() && walkCacheForRepo(full, repoToken, depth + 1)) return true
    } catch {
      continue
    }
  }
  return false
}

/** 已有缓存但无标记文件时，补写就绪标记（升级后兼容） */
export function syncReadyMarkersFromCache(): void {
  const registry = loadLocalModelsRegistry()
  for (const m of registry.caption) {
    if (isRepoCachedInFilesystem(m.hfRepo)) markModelReady(m.id, m.hfRepo)
  }
  for (const m of registry.embedding) {
    if (isRepoCachedInFilesystem(m.hfRepo)) markModelReady(m.id, m.hfRepo)
  }
}
