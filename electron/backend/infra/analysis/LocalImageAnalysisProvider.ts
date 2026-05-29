import { getDb } from '../../db/DatabaseManager'
import { configService } from '../../services/ConfigService'
import { findCaptionModel } from '../../services/LocalModelRegistry'
import { localModelService } from '../../services/LocalModelService'
import { mediaPreprocessor } from '../MediaPreprocessor'
import type { IImageAnalysisProvider, AnalyzeFileResult } from './IImageAnalysisProvider'
import { getLocalPromptVersion, mapLocalCaptionToPayload } from './LocalPayloadMapper'
import { mergeFrameCaptionsToPayload } from './FramePayloadMerger'

export class LocalImageAnalysisProvider implements IImageAnalysisProvider {
  async analyzeFile(filePath: string, mediaId?: string): Promise<AnalyzeFileResult> {
    const ready = await localModelService.isCaptionModelReady()
    if (!ready) {
      throw new Error('本地描述模型未下载，请在设置中下载本地模型')
    }

    const geoText = mediaId ? this.loadGeoText(mediaId) : null
    const prepared = await mediaPreprocessor.prepare(filePath)
    const modelId = configService.load().analysis.localCaptionModelId
    const entry = findCaptionModel(modelId)
    if (!entry) throw new Error(`未找到本地描述模型配置: ${modelId}`)

    if (prepared.kind === 'image') {
      const caption = await localModelService.captionImageFromPath(filePath, modelId)
      const colors = await mediaPreprocessor.extractDominantColors(prepared.buffer)
      return {
        payload: mapLocalCaptionToPayload({ caption, colors, geoText }),
        promptVersion: getLocalPromptVersion()
      }
    }

    const allColors: string[] = []
    for (const buffer of prepared.buffers) {
      const colors = await mediaPreprocessor.extractDominantColors(buffer)
      allColors.push(...colors)
    }
    const frameCaptions = (await localModelService.captionImages(prepared.buffers, modelId))
      .split('\n')
      .filter(Boolean)
    const uniqueColors = [...new Set(allColors)].slice(0, 5)
    return {
      payload: mergeFrameCaptionsToPayload({
        frameCaptions,
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

export const localImageAnalysisProvider = new LocalImageAnalysisProvider()
