import { getDb } from '../../db/DatabaseManager'
import { configService } from '../../services/ConfigService'
import { resolveCaptionOllamaModel } from '../../services/CaptionRuntime'
import { ollamaRuntimeService } from '../../services/OllamaRuntimeService'
import { findCaptionModel } from '../../services/LocalModelRegistry'
import { mediaPreprocessor } from '../MediaPreprocessor'
import { resolveLocalCaptionPrompt } from './LocalCaptionPrompt'
import { ollamaChat } from './OllamaCaptionClient'
import type { IImageAnalysisProvider, AnalyzeFileResult } from './IImageAnalysisProvider'
import { getLocalPromptVersion, mapLocalCaptionToPayload } from './LocalPayloadMapper'
import { mergeFrameCaptionsToPayload } from './FramePayloadMerger'

export class OllamaImageAnalysisProvider implements IImageAnalysisProvider {
  async analyzeFile(filePath: string, mediaId?: string): Promise<AnalyzeFileResult> {
    await ollamaRuntimeService.ensureReadyForAnalysis()

    const modelId = configService.load().analysis.localCaptionModelId
    const entry = findCaptionModel(modelId)
    if (!entry) throw new Error(`未找到本地描述模型配置: ${modelId}`)

    const ollamaModel = resolveCaptionOllamaModel(modelId)
    if (!ollamaModel) {
      throw new Error(`模型 ${modelId} 未配置 ollamaModel，请检查 config/local-models.json`)
    }

    const prompt = resolveLocalCaptionPrompt(entry)
    const geoText = mediaId ? this.loadGeoText(mediaId) : null
    const prepared = await mediaPreprocessor.prepare(filePath)

    if (prepared.kind === 'image') {
      const { content, ms } = await ollamaChat({
        model: ollamaModel,
        prompt,
        imageBuffer: prepared.buffer,
        numPredict: entry.maxNewTokens
      })
      console.log('[Ollama] 原始输出', {
        filePath,
        ms,
        contentLen: content.length,
        head: content.slice(0, 200).replace(/\s+/g, ' ')
      })
      const colors = await mediaPreprocessor.extractDominantColors(prepared.buffer)
      const payload = mapLocalCaptionToPayload({ caption: content, colors, geoText })
      console.log('[Ollama] 入库字段', {
        filePath,
        descriptionLen: payload.description.length,
        scene: payload.scene,
        objectCount: payload.objects.length
      })
      return {
        payload,
        promptVersion: getLocalPromptVersion()
      }
    }

    const captions: string[] = []
    const allColors: string[] = []
    for (const buffer of prepared.buffers) {
      const colors = await mediaPreprocessor.extractDominantColors(buffer)
      allColors.push(...colors)
      const { content } = await ollamaChat({
        model: ollamaModel,
        prompt,
        imageBuffer: buffer,
        numPredict: entry.maxNewTokens
      })
      captions.push(content)
    }

    const uniqueColors = [...new Set(allColors)].slice(0, 5)
    return {
      payload: mergeFrameCaptionsToPayload({
        frameCaptions: captions,
        colors: uniqueColors,
        geoText
      }),
      promptVersion: getLocalPromptVersion()
    }
  }

  private loadGeoText(mediaId: string): string | null {
    const row = getDb()
      .prepare('SELECT geo_text FROM media_metadata WHERE media_id = ?')
      .get(mediaId) as { geo_text?: string | null } | undefined
    return row?.geo_text ?? null
  }
}

export const ollamaImageAnalysisProvider = new OllamaImageAnalysisProvider()
