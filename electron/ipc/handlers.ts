import { ipcMain, dialog, BrowserWindow } from 'electron'
import { configService } from '../backend/services/ConfigService'
import { libraryService, importService } from '../backend/services/LibraryService'
import { searchService } from '../backend/services/SearchService'
import { llmSearchService } from '../backend/services/LLMSearchService'
import { embeddingService } from '../backend/services/EmbeddingService'
import { mediaService } from '../backend/services/MediaService'
import { analysisQueue } from '../backend/domain/AnalysisQueue'
import { textToImageService } from '../backend/services/TextToImageService'
import { imageEditService } from '../backend/services/ImageEditService'
import { lanServerService } from '../backend/services/LanServerService'
import { libraryWatcherService } from '../backend/services/LibraryWatcherService'
import { testLlmConnection } from '../backend/services/ConfigTestService'
import { aboutService } from '../backend/services/AboutService'
import { localModelService } from '../backend/services/LocalModelService'
import { ollamaRuntimeService } from '../backend/services/OllamaRuntimeService'
import { listOllamaVisionCatalog } from '../backend/services/CaptionRuntime'
import { localInferenceBridge } from '../backend/services/LocalInferenceBridge'
import { resetEmbeddingProviderCache } from '../backend/infra/embedding/EmbeddingProviderFactory'
import { resetTransformersEnv } from '../backend/infra/TransformersEnv'
import {
  inferenceDevicePreferenceLabel,
  listAvailableInferenceDevices
} from '../backend/infra/LocalInferenceDevice'
import type { AppConfig, ImageEditRequest, ImageEditSession, ImageGenRequest, ImageGenSession, MediaType, SearchQuery } from '../../shared/types'

export function registerIpcHandlers(): void {
  ipcMain.handle('about:getInfo', () => aboutService.getInfo())

  ipcMain.handle('config:get', () => configService.load())
  ipcMain.handle('config:save', async (_e, config: AppConfig) => {
    configService.save(config)
    configService.reload()
    resetEmbeddingProviderCache()
    resetTransformersEnv()
    localModelService.evictCaptionBackends()
    void localInferenceBridge.refreshConfig().catch((err) => console.error('Inference worker re-init failed:', err))
    await lanServerService.applyConfig()
  })
  ipcMain.handle('config:getDefaults', () => configService.getDefaults())
  ipcMain.handle('config:getRuntimeInfo', () => ({
    platform: process.platform,
    inferenceDevices: listAvailableInferenceDevices(process.platform).map((id) => ({
      id,
      label: inferenceDevicePreferenceLabel(id)
    }))
  }))
  ipcMain.handle('config:testLlm', () => testLlmConnection())

  ipcMain.handle('library:list', () => libraryService.list())
  ipcMain.handle('library:add', async (_e, rootPath: string, name?: string) => {
    const library = libraryService.add(rootPath, name)
    await libraryWatcherService.restart()
    return library
  })
  ipcMain.handle('library:remove', async (_e, id: string) => {
    libraryService.remove(id)
    await libraryWatcherService.restart()
  })
  ipcMain.handle('library:scan', async (e, id: string) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    return libraryService.scan(id, (progress) => {
      win?.webContents.send('import:progress', progress)
    })
  })
  ipcMain.handle('library:pickDirectory', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return result.canceled ? null : result.filePaths[0] ?? null
  })
  ipcMain.handle('library:openLocation', (_e, rootPath: string) => libraryService.openLocation(rootPath))

  ipcMain.handle('import:files', async (e, libraryId: string, filePaths: string[]) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    importService.onProgress((progress) => win?.webContents.send('import:progress', progress))
    return importService.importFiles(libraryId, filePaths)
  })
  ipcMain.handle('import:pickFiles', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Media', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'mp4', 'mov'] }]
    })
    return result.canceled ? [] : result.filePaths
  })

  ipcMain.handle('search:query', (_e, query: SearchQuery) => searchService.query(query))
  ipcMain.handle('search:llmQuery', (_e, query: SearchQuery) => llmSearchService.search(query))
  ipcMain.handle('media:list', (_e, libraryId?: string, page?: number, pageSize?: number) =>
    searchService.listMedia(libraryId, page, pageSize)
  )
  ipcMain.handle('media:getAnalysis', (_e, mediaId: string) => searchService.getAnalysis(mediaId))
  ipcMain.handle('media:retryAnalysis', async (_e, mediaId: string) => {
    await analysisQueue.retryMedia(mediaId, 'local')
  })
  ipcMain.handle('media:enhanceAnalysis', async (_e, mediaId: string) => {
    await analysisQueue.enhanceMedia(mediaId)
  })
  ipcMain.handle('media:cancelAnalysis', (_e, mediaId: string) => {
    analysisQueue.cancelMedia(mediaId)
  })
  ipcMain.handle('media:removeFromDb', (_e, mediaId: string) => {
    mediaService.removeFromDatabase(mediaId)
  })
  ipcMain.handle('media:deleteFromDisk', (_e, mediaId: string) => {
    mediaService.deleteFromDisk(mediaId)
  })
  ipcMain.handle('media:copyPath', (_e, filePath: string) => {
    mediaService.copyPath(filePath)
  })
  ipcMain.handle('media:copy', (_e, filePath: string, mediaType: MediaType) => {
    mediaService.copyMedia(filePath, mediaType)
  })
  ipcMain.handle('media:copyItems', (_e, items: Array<{ filePath: string; mediaType: MediaType }>) => {
    mediaService.copyMediaItems(items)
  })
  ipcMain.handle('media:showInFolder', (_e, filePath: string) => {
    mediaService.showInFolder(filePath)
  })
  ipcMain.handle('media:openFile', (_e, filePath: string) => mediaService.openFile(filePath))

  ipcMain.handle('analysis:start', async (_e, libraryId?: string) => analysisQueue.start(libraryId))
  ipcMain.handle('analysis:stop', () => analysisQueue.stop())
  ipcMain.handle('analysis:pause', () => analysisQueue.pause())
  ipcMain.handle('analysis:getProgress', () => analysisQueue.getProgress())
  ipcMain.handle('analysis:retryAllFailed', async () => analysisQueue.retryAllFailed())
  ipcMain.handle('analysis:enhanceBatch', async (_e, mediaIds: string[]) => analysisQueue.enhanceBatch(mediaIds))

  ipcMain.handle('localModel:getRegistry', () => localModelService.getRegistry())
  ipcMain.handle('localModel:getStatus', () => localModelService.getStatus())
  ipcMain.handle('localModel:download', async (e, modelId: string, kind: 'caption' | 'embedding') => {
    await localModelService.download(modelId, kind)
    const win = BrowserWindow.fromWebContents(e.sender)
    win?.webContents.send('localModel:downloadComplete', { modelId })
  })
  ipcMain.handle('localModel:cancel', () => localModelService.cancelDownload())

  ipcMain.handle('ollama:getStatus', () => ollamaRuntimeService.getStatus())
  ipcMain.handle('ollama:getVisionCatalog', () => listOllamaVisionCatalog())
  ipcMain.handle('ollama:setup', async () => ollamaRuntimeService.setup())
  ipcMain.handle('ollama:pullModel', async (_e, modelTag: string) => ollamaRuntimeService.pullVisionModel(modelTag))

  ipcMain.handle('embedding:backfill', async () => embeddingService.backfillMissing())
  ipcMain.handle('embedding:rebuild', async () => embeddingService.rebuildAll())
  ipcMain.handle('embedding:stats', () => embeddingService.getStats())

  ipcMain.handle('imageGen:generate', (_e, request: ImageGenRequest) => textToImageService.generate(request))
  ipcMain.handle('imageGen:accept', (_e, generationId: string) => textToImageService.accept(generationId))
  ipcMain.handle('imageGen:reject', (_e, generationId: string) => textToImageService.reject(generationId))
  ipcMain.handle('imageGen:loadSession', () => textToImageService.loadSession())
  ipcMain.handle('imageGen:saveSession', (_e, session: ImageGenSession) => {
    textToImageService.saveSession(session)
  })

  ipcMain.handle(
    'imageEdit:listLibraryImages',
    (_e, libraryId: string, page?: number, pageSize?: number, mediaTypes?: MediaType[]) =>
      imageEditService.listLibraryImages(libraryId, page, pageSize, mediaTypes)
  )
  ipcMain.handle('imageEdit:edit', (_e, request: ImageEditRequest) => imageEditService.edit(request))
  ipcMain.handle('imageEdit:saveAsNew', (_e, editId: string) => imageEditService.saveAsNew(editId))
  ipcMain.handle('imageEdit:overwrite', (_e, editId: string) => imageEditService.overwrite(editId))
  ipcMain.handle('imageEdit:reject', (_e, editId: string) => imageEditService.reject(editId))
  ipcMain.handle('imageEdit:loadSession', () => imageEditService.loadSession())
  ipcMain.handle('imageEdit:saveSession', (_e, session: ImageEditSession) => {
    imageEditService.saveSession(session)
  })

  ipcMain.handle('lanServer:getStatus', () => lanServerService.getStatus())
  ipcMain.handle('lanServer:regenerateToken', async () => {
    const token = lanServerService.regenerateToken()
    await lanServerService.applyConfig()
    return token
  })

  analysisQueue.onProgress((progress) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('analysis:progress', progress)
    }
  })

  localModelService.onDownloadProgress((payload) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('localModel:downloadProgress', payload)
    }
  })

  ollamaRuntimeService.onSetupProgress((status) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('ollama:setupProgress', status)
    }
  })
}
