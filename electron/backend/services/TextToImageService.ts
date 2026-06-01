import { mkdirSync, unlinkSync, existsSync } from 'fs'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { configService } from './ConfigService'
import { libraryService } from './LibraryService'
import { imageGenClient } from '../infra/ImageGenClient'
import { moveFileSync } from '../infra/fileMove'
import { importSingleFile, shouldQueueAnalysis } from './ImportHelper'
import { analysisQueue } from '../domain/AnalysisQueue'
import { imageGenSessionService } from './ImageGenSessionService'
import type { ImageGenAcceptResult, ImageGenRequest, ImageGenResult, ImageGenSession, Library } from '../../../shared/types'
import { APP_FILE_PREFIX } from '../../../shared/appMeta'

interface PendingGeneration {
  tempFilePath: string
  prompt: string
  libraryId: string
  libraryName: string
  width: number
  height: number
  requestId?: string
}

export class TextToImageService {
  private pending = new Map<string, PendingGeneration>()

  constructor() {
    this.rehydratePending()
  }

  loadSession(): ImageGenSession {
    const session = imageGenSessionService.load()
    this.rehydratePending(session.messages)
    return session
  }

  saveSession(session: ImageGenSession): void {
    imageGenSessionService.save(session)
    this.rehydratePending(session.messages)
  }

  private rehydratePending(messages?: ImageGenSession['messages']): void {
    const list = messages ?? imageGenSessionService.load().messages
    for (const msg of list) {
      if (msg.role !== 'assistant' || !msg.generation || msg.decision !== 'pending') continue
      const g = msg.generation
      if (!existsSync(g.tempFilePath)) continue
      this.pending.set(g.generationId, {
        tempFilePath: g.tempFilePath,
        prompt: g.prompt,
        libraryId: g.libraryId,
        libraryName: g.libraryName,
        width: g.width,
        height: g.height,
        requestId: g.requestId
      })
    }
  }

  private resolvePending(generationId: string): PendingGeneration {
    let pending = this.pending.get(generationId)
    if (!pending) {
      this.rehydratePending()
      pending = this.pending.get(generationId)
    }
    if (!pending) throw new Error('生成记录不存在或已处理')
    if (!existsSync(pending.tempFilePath)) {
      this.pending.delete(generationId)
      throw new Error('临时图片已不存在，请重新生成')
    }
    return pending
  }

  resolveLibrary(libraryId?: string): Library {
    const libraries = libraryService.list()
    if (libraries.length === 0) {
      throw new Error('请先在图库页面添加一个目录')
    }
    if (libraryId) {
      const found = libraries.find((l) => l.id === libraryId)
      if (!found) throw new Error('所选图库不存在')
      return found
    }
    return libraries[0]
  }

  async generate(params: ImageGenRequest): Promise<ImageGenResult> {
    const prompt = params.prompt.trim()
    if (!prompt) throw new Error('请输入图片描述')

    const library = this.resolveLibrary(params.libraryId)
    const generationId = uuidv4()
    const apiResult = await imageGenClient.generate(prompt, params.size, generationId)

    this.pending.set(generationId, {
      tempFilePath: apiResult.tempFilePath,
      prompt,
      libraryId: library.id,
      libraryName: library.name,
      width: apiResult.width,
      height: apiResult.height,
      requestId: apiResult.requestId
    })

    return {
      generationId,
      prompt,
      libraryId: library.id,
      libraryName: library.name,
      tempFilePath: apiResult.tempFilePath,
      width: apiResult.width,
      height: apiResult.height,
      requestId: apiResult.requestId
    }
  }

  async accept(generationId: string): Promise<ImageGenAcceptResult> {
    const pending = this.resolvePending(generationId)

    const library = libraryService.get(pending.libraryId)
    if (!library) throw new Error('目标图库不存在')

    const config = configService.load()
    const subfolder = config.imageGen.saveSubfolder.trim()
    const targetDir = subfolder ? join(library.rootPath, subfolder) : library.rootPath
    mkdirSync(targetDir, { recursive: true })

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const targetPath = join(targetDir, `${APP_FILE_PREFIX}-${timestamp}.png`)

    moveFileSync(pending.tempFilePath, targetPath)
    this.pending.delete(generationId)

    const result = await importSingleFile(library.id, targetPath)
    if (shouldQueueAnalysis(result)) await analysisQueue.start()

    return {
      filePath: targetPath,
      libraryId: library.id,
      libraryName: library.name,
      imported: result.action === 'added'
    }
  }

  async reject(generationId: string): Promise<void> {
    const pending = this.resolvePending(generationId)

    if (existsSync(pending.tempFilePath)) {
      try {
        unlinkSync(pending.tempFilePath)
      } catch {
        /* ignore cleanup errors */
      }
    }
    this.pending.delete(generationId)
  }
}

export const textToImageService = new TextToImageService()
