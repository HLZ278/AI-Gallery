import type { AppConfig } from '../../../shared/types'

export type WorkerRequestType =
  | 'init'
  | 'ping'
  | 'captionFromPath'
  | 'captionFromFrames'
  | 'embed'
  | 'download'
  | 'cancelDownload'
  | 'isCaptionReady'
  | 'isEmbeddingReady'
  | 'evictCaptionBackends'
  | 'shutdown'

export interface WorkerInitPayload {
  modelsCacheDir: string
  registryPath: string
  promptsDir: string
  appRoot: string
  /** 主进程已 merge 的完整 AppConfig JSON */
  configJson: string
}

export interface WorkerCaptionFromPathPayload {
  filePath: string
  modelId: string
  prompt: string
}

export interface WorkerCaptionFromFramesPayload {
  modelId: string
  prompt: string
  /** JPEG 帧 buffer，base64 */
  frames: string[]
}

export interface WorkerEmbedPayload {
  text: string
  modelId: string
}

export interface WorkerDownloadPayload {
  modelId: string
  kind: 'caption' | 'embedding'
}

export interface WorkerRequest {
  id: string
  type: WorkerRequestType
  payload?: unknown
}

export interface WorkerResponse {
  id: string
  ok: boolean
  result?: unknown
  error?: string
}

export type WorkerEventType = 'downloadProgress' | 'ready'

export interface WorkerEvent {
  type: WorkerEventType
  payload: unknown
}

export interface DownloadProgressPayload {
  modelId: string
  progress: number
}
