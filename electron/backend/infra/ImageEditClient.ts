import { configService } from '../services/ConfigService'
import { callDashScopeImageApi } from './DashScopeImageApi'
import { encodeImageForApi } from './imageEncoding'

export class ImageEditClient {
  async edit(
    sourceFilePaths: string[],
    prompt: string,
    tempBasename: string,
    size?: string
  ) {
    const config = configService.load()
    const imageEdit = config.imageEdit

    if (sourceFilePaths.length === 0) throw new Error('请至少选择一张源图片')
    if (sourceFilePaths.length > imageEdit.maxInputImages) {
      throw new Error(`最多同时输入 ${imageEdit.maxInputImages} 张图片`)
    }

    const encoded = await Promise.all(
      sourceFilePaths.map((filePath) => encodeImageForApi(filePath, imageEdit))
    )

    const content: Array<{ image: string } | { text: string }> = [
      ...encoded.map((item) => ({ image: item.dataUri })),
      { text: prompt }
    ]

    const parameters: Record<string, unknown> = {
      n: imageEdit.outputCount,
      negative_prompt: imageEdit.negativePrompt,
      prompt_extend: imageEdit.promptExtend,
      watermark: imageEdit.watermark
    }
    const resolvedSize = size?.trim() || imageEdit.size.trim()
    if (resolvedSize) parameters.size = resolvedSize

    return callDashScopeImageApi({
      model: imageEdit.model,
      endpoint: imageEdit.endpoint,
      timeoutMs: imageEdit.timeoutMs,
      content,
      parameters,
      tempBasename,
      tempSubdir: 'image-edits',
      errorPrefix: '图片编辑请求失败'
    })
  }
}

export const imageEditClient = new ImageEditClient()
