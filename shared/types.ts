export type MediaType = 'photo' | 'video' | 'gif' | 'live_photo' | 'panorama' | 'burst'

export type AnalysisStatus = 'pending' | 'processing' | 'done' | 'failed'

export interface AppConfig {
  llm: {
    apiKey: string
    baseUrl: string
    model: string
    maxConcurrency: number
    timeoutMs: number
    maxRetries: number
  }
  analysis: {
    videoFrameCount: number
    gifFrameCount: number
    sequenceFrameFps: number
    sequenceMinFrames: number
    maxImageEdgePx: number
    skipIfHashUnchanged: boolean
  }
  search: {
    maxCatalogItems: number
    chunkSize: number
  }
  embedding: {
    enabled: boolean
    model: string
    minScore: number
    topK: number
    autoIndexOnAnalysis: boolean
  }
  ui: {
    theme: 'system' | 'light' | 'dark'
    gridColumnMinWidth: number
  }
  imageGen: {
    model: string
    endpoint: string
    size: string
    availableSizes: string[]
    negativePrompt: string
    promptExtend: boolean
    watermark: boolean
    timeoutMs: number
    saveSubfolder: string
  }
  imageEdit: {
    model: string
    endpoint: string
    size: string
    availableSizes: string[]
    maxInputImages: number
    maxInputBytes: number
    maxInputEdgePx: number
    minInputEdgePx: number
    allowedExtensions: string[]
    supportedMediaTypes: MediaType[]
    negativePrompt: string
    promptExtend: boolean
    watermark: boolean
    outputCount: number
    timeoutMs: number
    saveSubfolder: string
  }
  lanServer: {
    enabled: boolean
    port: number
    token: string
    uploadSubfolder: string
    pageSize: number
    maxUploadBytes: number
    downloadIntervalMs: number
    allowedExtensions: string[]
  }
}

export interface LanServerStatus {
  enabled: boolean
  running: boolean
  port: number
  token: string
  addresses: string[]
  urls: string[]
  hostname: string
}

export interface Library {
  id: string
  name: string
  rootPath: string
  createdAt: number
  mediaCount?: number
  analyzedCount?: number
  pendingCount?: number
  totalSize?: number
}

export interface MediaItem {
  id: string
  libraryId: string
  filePath: string
  fileHash: string
  fileSize: number
  width: number
  height: number
  takenAt: number | null
  importedAt: number
  mediaType: MediaType
  thumbPath: string | null
  analysisStatus: AnalysisStatus
  analysisError?: string | null
  libraryName?: string
  durationMs?: number | null
  frameCount?: number | null
  geoText?: string | null
}

export interface AnalysisResult {
  mediaId: string
  rawJson: string
  description: string
  objects: string[]
  people: string[]
  scene: string
  location: string
  story: string
  trendTags: string[]
  mood: string
  colors: string[]
  ocrText: string
  ipReferences: string[]
  isMeme: boolean
  modelName: string
  promptVersion: string
  analyzedAt: number
}

export interface SearchQuery {
  keyword?: string
  mode?: SearchMode
  dateFrom?: number
  dateTo?: number
  mediaTypes?: MediaType[]
  libraryIds?: string[]
  page?: number
  pageSize?: number
}

export interface SearchResult {
  items: MediaItem[]
  analysisMap: Record<string, AnalysisResult>
  total: number
  page: number
  pageSize: number
  searchMode?: SearchMode
  llmReason?: string
  vectorScoreMap?: Record<string, number>
}

export interface ImportProgress {
  total: number
  processed: number
  currentFile: string
  phase: 'scanning' | 'importing' | 'analyzing' | 'done' | 'error'
  message: string
}

export interface AnalysisProgress {
  pending: number
  processing: number
  done: number
  failed: number
  isRunning: boolean
  isStopping?: boolean
  total: number
  completed: number
  percent: number
  currentFiles: Array<{ mediaId: string; fileName: string; filePath: string }>
  concurrency?: number
}

export type SearchMode = 'keyword' | 'llm' | 'vector'

export interface ImageGenRequest {
  prompt: string
  libraryId?: string
  size?: string
}

export interface ImageGenResult {
  generationId: string
  prompt: string
  libraryId: string
  libraryName: string
  tempFilePath: string
  width: number
  height: number
  requestId?: string
}

export interface ImageGenAcceptResult {
  filePath: string
  libraryId: string
  libraryName: string
  imported: boolean
}

export type ImageGenDecision = 'pending' | 'accepted' | 'rejected'

export interface ImageGenStoredMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  generation?: ImageGenResult
  decision?: ImageGenDecision
  acceptResult?: ImageGenAcceptResult
  error?: string
}

export interface ImageGenSession {
  libraryId: string
  size: string
  messages: ImageGenStoredMessage[]
}

export interface ImageEditRequest {
  sourceMediaIds: string[]
  prompt: string
  size?: string
}

export interface ImageEditResult {
  editId: string
  prompt: string
  sourceMediaIds: string[]
  sourceFilePaths: string[]
  sourceFileNames: string[]
  libraryId: string
  libraryName: string
  tempFilePath: string
  width: number
  height: number
  requestId?: string
}

export interface ImageEditAcceptResult {
  filePath: string
  libraryId: string
  libraryName: string
  imported: boolean
}

export interface ImageEditOverwriteResult {
  mediaId: string
  filePath: string
  libraryId: string
  libraryName: string
  replacedOriginalPath: string
}

export type ImageEditDecision = 'pending' | 'saved' | 'overwritten' | 'rejected'

export interface ImageEditStoredMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  edit?: ImageEditResult
  decision?: ImageEditDecision
  acceptResult?: ImageEditAcceptResult
  overwriteResult?: ImageEditOverwriteResult
  error?: string
}

export interface ImageEditSession {
  libraryId: string
  size: string
  sourceMediaIds: string[]
  messages: ImageEditStoredMessage[]
}

export interface ImageAnalysisPayload {
  description: string
  objects: string[]
  people: string[]
  scene: string
  location: string
  story: string
  trend_tags: string[]
  mood: string
  colors: string[]
  ocr_text: string
  is_meme?: boolean
  ip_references?: string[]
}

export interface IpcApi {
  config: {
    get: () => Promise<AppConfig>
    save: (config: AppConfig) => Promise<void>
    getDefaults: () => Promise<AppConfig>
    testLlm: () => Promise<{ ok: boolean; message: string }>
  }
  library: {
    list: () => Promise<Library[]>
    add: (rootPath: string, name?: string) => Promise<Library>
    remove: (id: string) => Promise<void>
    scan: (id: string) => Promise<{ imported: number }>
    pickDirectory: () => Promise<string | null>
    openLocation: (rootPath: string) => Promise<string>
  }
  import: {
    files: (libraryId: string, filePaths: string[]) => Promise<{ imported: number }>
    pickFiles: () => Promise<string[]>
    onProgress: (callback: (progress: ImportProgress) => void) => () => void
  }
  search: {
    query: (query: SearchQuery) => Promise<SearchResult>
    llmQuery: (query: SearchQuery) => Promise<SearchResult>
  }
  media: {
    list: (libraryId?: string, page?: number, pageSize?: number) => Promise<SearchResult>
    getAnalysis: (mediaId: string) => Promise<AnalysisResult | null>
    retryAnalysis: (mediaId: string) => Promise<void>
    removeFromDb: (mediaId: string) => Promise<void>
    deleteFromDisk: (mediaId: string) => Promise<void>
    copy: (filePath: string, mediaType: MediaType) => Promise<void>
    copyItems: (items: Array<{ filePath: string; mediaType: MediaType }>) => Promise<void>
    copyPath: (filePath: string) => Promise<void>
    showInFolder: (filePath: string) => Promise<void>
    openFile: (filePath: string) => Promise<void>
  }
  analysis: {
    start: () => Promise<void>
    stop: () => Promise<void>
    pause: () => Promise<void>
    retryAllFailed: () => Promise<number>
    getProgress: () => Promise<AnalysisProgress>
    onProgress: (callback: (progress: AnalysisProgress) => void) => () => void
  }
  embedding: {
    backfill: () => Promise<{ indexed: number; failed: number; skipped?: number }>
    rebuild: () => Promise<{ indexed: number; failed: number; skipped?: number }>
    getStats: () => Promise<{ total: number; indexed: number; pending: number; staleModel?: number; enabled?: boolean }>
  }
  imageGen: {
    generate: (request: ImageGenRequest) => Promise<ImageGenResult>
    accept: (generationId: string) => Promise<ImageGenAcceptResult>
    reject: (generationId: string) => Promise<void>
    loadSession: () => Promise<ImageGenSession>
    saveSession: (session: ImageGenSession) => Promise<void>
  }
  imageEdit: {
    listLibraryImages: (
      libraryId: string,
      page?: number,
      pageSize?: number,
      mediaTypes?: MediaType[]
    ) => Promise<MediaItem[]>
    edit: (request: ImageEditRequest) => Promise<ImageEditResult>
    saveAsNew: (editId: string) => Promise<ImageEditAcceptResult>
    overwrite: (editId: string) => Promise<ImageEditOverwriteResult>
    reject: (editId: string) => Promise<void>
    loadSession: () => Promise<ImageEditSession>
    saveSession: (session: ImageEditSession) => Promise<void>
  }
  lanServer: {
    getStatus: () => Promise<LanServerStatus>
    regenerateToken: () => Promise<string>
    onUploadComplete: (callback: (payload: { libraryId: string; fileName: string; imported: boolean }) => void) => () => void
  }
}

declare global {
  interface Window {
    api: IpcApi
  }
}

export {}
