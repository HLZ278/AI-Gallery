export type MediaType = 'photo' | 'video' | 'gif' | 'live_photo' | 'panorama' | 'burst'

export type AnalysisStatus = 'pending' | 'processing' | 'done' | 'failed'

export type AnalysisMode = 'local' | 'cloud'

export type EmbeddingProviderType = 'local' | 'cloud'

export type InferenceDevicePreference = 'auto' | 'wasm' | 'cuda' | 'dml'

export interface LocalModelDtypeConfig {
  embed_tokens?: string
  vision_encoder?: string
  decoder_model_merged?: string
}

export interface LocalModelEntry {
  id: string
  label: string
  hfRepo: string
  /** qwen2.5-vl | qwen3-vl | feature-extraction */
  pipeline: string
  captionPrompt?: string
  /** 为 true 时使用 prompts/image_analysis 的 local_caption_instruction（与云端维度对齐） */
  useAnalysisPrompt?: boolean
  maxNewTokens?: number
  imageEdge?: number
  dtype?: LocalModelDtypeConfig
  recommended?: boolean
  recommendedConcurrency?: number
  estimatedSizeMb?: number
  dimensions?: number
  deprecated?: boolean
}

export interface LocalModelsRegistry {
  caption: LocalModelEntry[]
  embedding: LocalModelEntry[]
}

export interface LocalModelStatusItem {
  id: string
  label: string
  kind: 'caption' | 'embedding'
  ready: boolean
  downloading: boolean
  progress?: number
  error?: string
  estimatedSizeMb?: number
}

export interface LocalModelStatus {
  modelsDir: string
  cacheSizeMb: number
  effectiveRemoteHost: string
  items: LocalModelStatusItem[]
  allReady: boolean
}

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
    defaultMode: AnalysisMode
    localCaptionModelId: string
    localConcurrency: number
    fallbackToCloudWhenLocalUnavailable: boolean
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
  localModels: {
    /** 留空则读取环境变量 HF_ENDPOINT，再回退 huggingface.co；国内可填 https://hf-mirror.com */
    remoteHost: string
    /** 留空使用库默认：{model}/resolve/{revision}/（勿含 {file}，文件名由库自动追加） */
    remotePathTemplate: string
    /** 可选 HF 只读 Token；部分网络/模型需要 */
    hfToken: string
    /** 为 true 时忽略系统环境变量中的 HF_TOKEN，避免无效 token 导致 401 */
    ignoreEnvHfToken: boolean
    /** auto/wasm：ONNX CPU；cuda：NVIDIA；dml 在桌面端会映射为 CPU（Qwen VL 勿用 DirectML） */
    inferenceDevice: InferenceDevicePreference
  }
  embedding: {
    enabled: boolean
    provider: EmbeddingProviderType
    model: string
    localModelId: string
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

export interface AppAboutInfo {
  productName: string
  version: string
  contactEmail: string
  licenseName: string
  licenseText: string
  releaseDate: string
  releaseHighlights: string[]
  copyright: string
}

export interface IpcApi {
  about: {
    getInfo: () => Promise<AppAboutInfo>
  }
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
    enhanceAnalysis: (mediaId: string) => Promise<void>
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
    enhanceBatch: (mediaIds: string[]) => Promise<number>
    getProgress: () => Promise<AnalysisProgress>
    onProgress: (callback: (progress: AnalysisProgress) => void) => () => void
  }
  localModel: {
    getRegistry: () => Promise<LocalModelsRegistry>
    getStatus: () => Promise<LocalModelStatus>
    download: (modelId: string, kind: 'caption' | 'embedding') => Promise<void>
    cancelDownload: () => Promise<void>
    onDownloadProgress: (callback: (payload: { modelId: string; progress: number }) => void) => () => void
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
