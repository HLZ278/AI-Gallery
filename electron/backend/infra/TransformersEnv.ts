import { getActiveConfig } from './ActiveConfig'
import { findCaptionModel, findEmbeddingModel, getModelsCacheDir } from '../services/LocalModelRegistry'
import { isRepoCachedInFilesystem } from '../services/LocalModelReady'

const LOG_PREFIX = '[LocalModel]'
const DEFAULT_REMOTE_HOST = 'https://huggingface.co'
/** 与 @huggingface/transformers 默认一致；文件名由库在模板后追加 */
const DEFAULT_PATH_TEMPLATE = '{model}/resolve/{revision}/'

let configured = false
let fetchPatched = false
let savedEnvTokens: { HF_TOKEN?: string; HF_ACCESS_TOKEN?: string } | null = null

function log(message: string, extra?: unknown): void {
  if (extra !== undefined) console.log(LOG_PREFIX, message, extra)
  else console.log(LOG_PREFIX, message)
}

function isHubFileUrl(url: string): boolean {
  try {
    const u = new URL(url)
    const host = u.hostname
    return (
      host === 'huggingface.co' ||
      host.endsWith('.huggingface.co') ||
      host === 'hf.co' ||
      host === 'hf-mirror.com' ||
      host.endsWith('.hf-mirror.com')
    )
  } catch {
    return false
  }
}

function installFetchDiagnostics(): void {
  if (fetchPatched || typeof globalThis.fetch !== 'function') return
  const nativeFetch = globalThis.fetch.bind(globalThis)
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url
    if (!isHubFileUrl(url)) {
      return nativeFetch(input, init)
    }

    const headers = new Headers(init?.headers)
    const hasAuth = headers.has('Authorization')
    log(`fetch ${url}`, { hasAuth })

    let response = await nativeFetch(input, init)
    log(`response ${response.status}`, {
      url,
      redirected: response.redirected,
      finalUrl: response.redirected ? response.url : undefined
    })

    if (response.status === 401 && hasAuth) {
      log('401 with Authorization — retry without token', url)
      const retryHeaders = new Headers(init?.headers)
      retryHeaders.delete('Authorization')
      response = await nativeFetch(input, { ...init, headers: retryHeaders })
      log(`retry status ${response.status}`, url)
    }

    return response
  }
  fetchPatched = true
}

/** 避免系统里无效 HF_TOKEN 导致 "Invalid username or password" */
export function applyHfTokenForDownload(): void {
  const config = getActiveConfig().localModels
  if (!savedEnvTokens) {
    savedEnvTokens = {
      HF_TOKEN: process.env.HF_TOKEN,
      HF_ACCESS_TOKEN: process.env.HF_ACCESS_TOKEN
    }
  }

  if (config?.ignoreEnvHfToken) {
    delete process.env.HF_TOKEN
    delete process.env.HF_ACCESS_TOKEN
  }

  const token = config?.hfToken?.trim()
  if (token) {
    process.env.HF_TOKEN = token
    log('using HF token from config.localModels.hfToken')
  } else if (config?.ignoreEnvHfToken) {
    log('ignoreEnvHfToken=true, cleared HF_TOKEN from environment for download')
  }
}

export function restoreHfTokenAfterDownload(): void {
  if (!savedEnvTokens) return
  if (savedEnvTokens.HF_TOKEN !== undefined) process.env.HF_TOKEN = savedEnvTokens.HF_TOKEN
  else delete process.env.HF_TOKEN
  if (savedEnvTokens.HF_ACCESS_TOKEN !== undefined) process.env.HF_ACCESS_TOKEN = savedEnvTokens.HF_ACCESS_TOKEN
  else delete process.env.HF_ACCESS_TOKEN
  savedEnvTokens = null
}

export async function applyTransformersEnv(): Promise<void> {
  installFetchDiagnostics()
  if (configured) return
  const { env } = await import('@huggingface/transformers')
  const config = getActiveConfig()
  const cacheDir = getModelsCacheDir()

  env.cacheDir = cacheDir
  env.useFSCache = true
  env.allowRemoteModels = true
  env.allowLocalModels = true

  const remoteHost = resolveRemoteHost(config.localModels?.remoteHost)
  env.remoteHost = remoteHost.endsWith('/') ? remoteHost : `${remoteHost}/`
  const customTemplate = config.localModels?.remotePathTemplate?.trim()
  env.remotePathTemplate =
    customTemplate && !customTemplate.includes('{file}')
      ? customTemplate.endsWith('/')
        ? customTemplate
        : `${customTemplate}/`
      : DEFAULT_PATH_TEMPLATE

  log('transformers env', {
    cacheDir,
    remoteHost: env.remoteHost,
    remotePathTemplate: env.remotePathTemplate
  })

  configured = true
}

export function resetTransformersEnv(): void {
  configured = false
}

export function getEffectiveRemoteHost(): string {
  return resolveRemoteHost(getActiveConfig().localModels?.remoteHost)
}

function resolveRemoteHost(configHost?: string): string {
  const fromConfig = configHost?.trim()
  if (fromConfig) return fromConfig.replace(/\/$/, '')

  const fromEnv = process.env.HF_ENDPOINT?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')

  return DEFAULT_REMOTE_HOST
}

function buildResolveUrl(hfRepo: string, fileName: string): string {
  const host = getEffectiveRemoteHost()
  return `${host}/${hfRepo}/resolve/main/${fileName}`
}

export async function probeRepoFile(hfRepo: string, fileName = 'tokenizer_config.json'): Promise<{
  ok: boolean
  status: number
  url: string
  hint: string
}> {
  const url = buildResolveUrl(hfRepo, fileName)
  applyHfTokenForDownload()
  try {
    const headers: Record<string, string> = { 'User-Agent': 'PictureSearch/1.8.2 local-model-probe' }
    const token = process.env.HF_TOKEN?.trim()
    if (token) headers.Authorization = `Bearer ${token}`
    log(`probe ${url}`)
    const res = await fetch(url, { headers, redirect: 'follow' })
    log(`probe result ${res.status}`, res.url)
    if (res.ok) {
      return { ok: true, status: res.status, url, hint: '可访问' }
    }
    if (res.status === 401) {
      return {
        ok: false,
        status: res.status,
        url,
        hint:
          '401：该模型在 Hugging Face 可能已受限，请检查 registry 中的 Qwen VL 模型；若网络走镜像仍失败，可填写有效的 HF 只读 Token'
      }
    }
    return { ok: false, status: res.status, url, hint: `HTTP ${res.status}` }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, status: 0, url, hint: msg }
  } finally {
    restoreHfTokenAfterDownload()
  }
}

/** 下载前检查 caption / embedding 模型是否可访问 */
export async function assertModelDownloadable(modelId: string, kind: 'caption' | 'embedding'): Promise<void> {
  const entry = kind === 'caption' ? findCaptionModel(modelId) : findEmbeddingModel(modelId)
  if (!entry) throw new Error(`未知模型: ${modelId}`)
  const probe = await probeRepoFile(entry.hfRepo)
  if (!probe.ok) {
    throw new Error(`模型 ${entry.hfRepo} 无法下载 (${probe.status}): ${probe.hint}\n探测 URL: ${probe.url}`)
  }
}

export function isRepoFullyCached(hfRepo: string): boolean {
  return isRepoCachedInFilesystem(hfRepo)
}
