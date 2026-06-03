import { contextBridge, ipcRenderer } from 'electron'
import type { AppConfig, ImageEditRequest, ImageEditSession, ImageGenRequest, ImageGenSession, MediaType, SearchQuery } from '../shared/types'

const api = {
  about: {
    getInfo: () => ipcRenderer.invoke('about:getInfo')
  },
  config: {
    get: (): Promise<AppConfig> => ipcRenderer.invoke('config:get'),
    save: (config: AppConfig): Promise<void> => ipcRenderer.invoke('config:save', config),
    getDefaults: (): Promise<AppConfig> => ipcRenderer.invoke('config:getDefaults'),
    getRuntimeInfo: () => ipcRenderer.invoke('config:getRuntimeInfo'),
    testLlm: (): Promise<{ ok: boolean; message: string }> => ipcRenderer.invoke('config:testLlm')
  },
  library: {
    list: () => ipcRenderer.invoke('library:list'),
    add: (rootPath: string, name?: string) => ipcRenderer.invoke('library:add', rootPath, name),
    remove: (id: string) => ipcRenderer.invoke('library:remove', id),
    scan: (id: string) => ipcRenderer.invoke('library:scan', id),
    pickDirectory: () => ipcRenderer.invoke('library:pickDirectory'),
    openLocation: (rootPath: string) => ipcRenderer.invoke('library:openLocation', rootPath)
  },
  import: {
    files: (libraryId: string, filePaths: string[]) => ipcRenderer.invoke('import:files', libraryId, filePaths),
    pickFiles: () => ipcRenderer.invoke('import:pickFiles'),
    onProgress: (callback: (progress: unknown) => void) => {
      const handler = (_: unknown, progress: unknown) => callback(progress)
      ipcRenderer.on('import:progress', handler)
      return () => ipcRenderer.removeListener('import:progress', handler)
    }
  },
  search: {
    query: (query: SearchQuery) => ipcRenderer.invoke('search:query', query),
    llmQuery: (query: SearchQuery) => ipcRenderer.invoke('search:llmQuery', query)
  },
  media: {
    list: (libraryId?: string, page?: number, pageSize?: number) =>
      ipcRenderer.invoke('media:list', libraryId, page, pageSize),
    getAnalysis: (mediaId: string) => ipcRenderer.invoke('media:getAnalysis', mediaId),
    retryAnalysis: (mediaId: string) => ipcRenderer.invoke('media:retryAnalysis', mediaId),
    enhanceAnalysis: (mediaId: string) => ipcRenderer.invoke('media:enhanceAnalysis', mediaId),
    cancelAnalysis: (mediaId: string) => ipcRenderer.invoke('media:cancelAnalysis', mediaId),
    removeFromDb: (mediaId: string) => ipcRenderer.invoke('media:removeFromDb', mediaId),
    deleteFromDisk: (mediaId: string) => ipcRenderer.invoke('media:deleteFromDisk', mediaId),
    copyPath: (filePath: string) => ipcRenderer.invoke('media:copyPath', filePath),
    copy: (filePath: string, mediaType: MediaType) => ipcRenderer.invoke('media:copy', filePath, mediaType),
    copyItems: (items: Array<{ filePath: string; mediaType: MediaType }>) =>
      ipcRenderer.invoke('media:copyItems', items),
    showInFolder: (filePath: string) => ipcRenderer.invoke('media:showInFolder', filePath),
    openFile: (filePath: string) => ipcRenderer.invoke('media:openFile', filePath)
  },
  analysis: {
    start: (libraryId?: string) => ipcRenderer.invoke('analysis:start', libraryId),
    stop: () => ipcRenderer.invoke('analysis:stop'),
    pause: () => ipcRenderer.invoke('analysis:pause'),
    getProgress: () => ipcRenderer.invoke('analysis:getProgress'),
    retryAllFailed: () => ipcRenderer.invoke('analysis:retryAllFailed'),
    enhanceBatch: (mediaIds: string[]) => ipcRenderer.invoke('analysis:enhanceBatch', mediaIds),
    onProgress: (callback: (progress: unknown) => void) => {
      const handler = (_: unknown, progress: unknown) => callback(progress)
      ipcRenderer.on('analysis:progress', handler)
      return () => ipcRenderer.removeListener('analysis:progress', handler)
    }
  },
  embedding: {
    backfill: () => ipcRenderer.invoke('embedding:backfill'),
    rebuild: () => ipcRenderer.invoke('embedding:rebuild'),
    getStats: () => ipcRenderer.invoke('embedding:stats')
  },
  imageGen: {
    generate: (request: ImageGenRequest) => ipcRenderer.invoke('imageGen:generate', request),
    accept: (generationId: string) => ipcRenderer.invoke('imageGen:accept', generationId),
    reject: (generationId: string) => ipcRenderer.invoke('imageGen:reject', generationId),
    loadSession: () => ipcRenderer.invoke('imageGen:loadSession'),
    saveSession: (session: ImageGenSession) => ipcRenderer.invoke('imageGen:saveSession', session)
  },
  imageEdit: {
    listLibraryImages: (libraryId: string, page?: number, pageSize?: number, mediaTypes?: MediaType[]) =>
      ipcRenderer.invoke('imageEdit:listLibraryImages', libraryId, page, pageSize, mediaTypes),
    edit: (request: ImageEditRequest) => ipcRenderer.invoke('imageEdit:edit', request),
    saveAsNew: (editId: string) => ipcRenderer.invoke('imageEdit:saveAsNew', editId),
    overwrite: (editId: string) => ipcRenderer.invoke('imageEdit:overwrite', editId),
    reject: (editId: string) => ipcRenderer.invoke('imageEdit:reject', editId),
    loadSession: () => ipcRenderer.invoke('imageEdit:loadSession'),
    saveSession: (session: ImageEditSession) => ipcRenderer.invoke('imageEdit:saveSession', session)
  },
  localModel: {
    getRegistry: () => ipcRenderer.invoke('localModel:getRegistry'),
    getStatus: () => ipcRenderer.invoke('localModel:getStatus'),
    download: (modelId: string, kind: 'caption' | 'embedding') =>
      ipcRenderer.invoke('localModel:download', modelId, kind),
    cancelDownload: () => ipcRenderer.invoke('localModel:cancel'),
    onDownloadProgress: (callback: (payload: { modelId: string; progress: number }) => void) => {
      const handler = (_: unknown, payload: { modelId: string; progress: number }) => callback(payload)
      ipcRenderer.on('localModel:downloadProgress', handler)
      return () => ipcRenderer.removeListener('localModel:downloadProgress', handler)
    }
  },
  ollama: {
    getStatus: () => ipcRenderer.invoke('ollama:getStatus'),
    getVisionCatalog: () => ipcRenderer.invoke('ollama:getVisionCatalog'),
    setup: () => ipcRenderer.invoke('ollama:setup'),
    pullModel: (modelTag: string) => ipcRenderer.invoke('ollama:pullModel', modelTag),
    onSetupProgress: (callback: (status: import('../shared/types').OllamaRuntimeStatus) => void) => {
      const handler = (_: unknown, status: import('../shared/types').OllamaRuntimeStatus) => callback(status)
      ipcRenderer.on('ollama:setupProgress', handler)
      return () => ipcRenderer.removeListener('ollama:setupProgress', handler)
    }
  },
  lanServer: {
    getStatus: () => ipcRenderer.invoke('lanServer:getStatus'),
    regenerateToken: () => ipcRenderer.invoke('lanServer:regenerateToken'),
    onUploadComplete: (callback: (payload: { libraryId: string; fileName: string; imported: boolean }) => void) => {
      const handler = (_: unknown, payload: { libraryId: string; fileName: string; imported: boolean }) => callback(payload)
      ipcRenderer.on('lanServer:uploadComplete', handler)
      return () => ipcRenderer.removeListener('lanServer:uploadComplete', handler)
    }
  },
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close')
  }
}

contextBridge.exposeInMainWorld('api', api)
