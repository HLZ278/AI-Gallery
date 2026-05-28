import OpenAI from 'openai'
import { configService } from '../../services/ConfigService'
import { promptBuilder } from '../../domain/PromptBuilder'
import { mediaPreprocessor } from '../MediaPreprocessor'
import { isVideoFile } from '../VideoFrameExtractor'
import { isGifFile } from '../GifFrameExtractor'
import { toDataUrls } from '../frameSequenceUtils'
import { extractJsonObject, mapStructuredPayload } from './AnalysisPayloadMapper'
import type { AnalyzeFileResult, IImageAnalysisProvider } from './IImageAnalysisProvider'

type SequenceKind = 'video' | 'gif'

function extractJson(text: string): Record<string, unknown> {
  const raw = extractJsonObject(text)
  if (!raw) throw new Error('No JSON found in model response')
  return raw
}

export class CloudImageAnalysisProvider implements IImageAnalysisProvider {
  private getClient(): OpenAI {
    const config = configService.load().llm
    return new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      timeout: config.timeoutMs
    })
  }

  async analyzeFile(filePath: string): Promise<AnalyzeFileResult> {
    if (isVideoFile(filePath)) {
      const frames = await mediaPreprocessor.prepareVideoFrames(filePath)
      return this.analyzeFrameSequence(frames, 'video')
    }
    if (isGifFile(filePath)) {
      const frames = await mediaPreprocessor.prepareGifFrames(filePath)
      return this.analyzeFrameSequence(frames, 'gif')
    }
    const { base64, mimeType } = await mediaPreprocessor.prepareImageBase64(filePath)
    return this.analyzeImage(base64, mimeType)
  }

  private async analyzeImage(imageBase64: string, mimeType: string): Promise<AnalyzeFileResult> {
    const config = configService.load()
    const prompt = promptBuilder.loadImagePrompt()
    const client = this.getClient()

    const response = await client.chat.completions.create({
      model: config.llm.model,
      messages: [
        { role: 'system', content: prompt.system },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt.user_template },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } }
          ]
        }
      ],
      max_tokens: 2048
    })

    const content = response.choices[0]?.message?.content ?? ''
    const raw = extractJson(typeof content === 'string' ? content : JSON.stringify(content))
    return { payload: mapStructuredPayload(raw), promptVersion: prompt.version }
  }

  private async analyzeFrameSequence(
    frames: Array<{ base64: string; mimeType: string }>,
    kind: SequenceKind
  ): Promise<AnalyzeFileResult> {
    const config = configService.load()
    const prompt = kind === 'gif' ? promptBuilder.loadGifPrompt() : promptBuilder.loadVideoPrompt()
    const client = this.getClient()
    const userText = prompt.user_template.replace('{{frame_count}}', String(frames.length))
    const fps = config.analysis.sequenceFrameFps

    const videoPart = {
      type: 'video' as const,
      video: toDataUrls(frames),
      fps
    }

    const response = await client.chat.completions.create({
      model: config.llm.model,
      messages: [
        { role: 'system', content: prompt.system },
        {
          role: 'user',
          content: [videoPart, { type: 'text', text: userText }] as OpenAI.Chat.Completions.ChatCompletionContentPart[]
        }
      ],
      max_tokens: 2048
    })

    const content = response.choices[0]?.message?.content ?? ''
    const raw = extractJson(typeof content === 'string' ? content : JSON.stringify(content))
    return { payload: mapStructuredPayload(raw), promptVersion: prompt.version }
  }
}

export const cloudImageAnalysisProvider = new CloudImageAnalysisProvider()
