import { configService } from '../services/ConfigService'
import { callDashScopeImageApi } from './DashScopeImageApi'

export interface ImageGenApiResult {
  tempFilePath: string
  width: number
  height: number
  requestId?: string
}

export class ImageGenClient {
  async generate(prompt: string, size?: string, tempBasename?: string): Promise<ImageGenApiResult> {
    const config = configService.load()
    const imageGen = config.imageGen

    return callDashScopeImageApi({
      model: imageGen.model,
      endpoint: imageGen.endpoint,
      timeoutMs: imageGen.timeoutMs,
      content: [{ text: prompt }],
      parameters: {
        negative_prompt: imageGen.negativePrompt,
        prompt_extend: imageGen.promptExtend,
        watermark: imageGen.watermark,
        size: size ?? imageGen.size
      },
      tempBasename: tempBasename ?? `gen-${Date.now()}`,
      tempSubdir: 'generations',
      errorPrefix: '文生图请求失败'
    })
  }
}

export const imageGenClient = new ImageGenClient()
