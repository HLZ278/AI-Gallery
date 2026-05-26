import OpenAI from 'openai'
import sharp from 'sharp'
import { configService } from '../services/ConfigService'
import { promptBuilder } from '../domain/PromptBuilder'
import { extractVideoFrames, isVideoFile, resizeFrameBuffer } from './VideoFrameExtractor'
import { extractGifFrames, isGifFile } from './GifFrameExtractor'
import { padFrameBuffers, toDataUrls } from './frameSequenceUtils'
import type { ImageAnalysisPayload } from '../../../shared/types'

type SequenceKind = 'video' | 'gif'

function extractJson(text: string): Record<string, unknown> {
  const trimmed = text.trim()
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON found in model response')
  return JSON.parse(jsonMatch[0]) as Record<string, unknown>
}

function toStringArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String)
  if (typeof val === 'string' && val) return [val]
  return []
}

function mapPayload(raw: Record<string, unknown>): ImageAnalysisPayload {
  return {
    description: String(raw.description ?? ''),
    objects: toStringArray(raw.objects),
    people: toStringArray(raw.people),
    scene: String(raw.scene ?? ''),
    location: String(raw.location ?? ''),
    story: String(raw.story ?? ''),
    trend_tags: toStringArray(raw.trend_tags),
    mood: String(raw.mood ?? ''),
    colors: toStringArray(raw.colors),
    ocr_text: String(raw.ocr_text ?? ''),
    is_meme: Boolean(raw.is_meme),
    ip_references: toStringArray(raw.ip_references)
  }
}

async function buffersToFramePayloads(buffers: Buffer[]): Promise<Array<{ base64: string; mimeType: string }>> {
  return buffers.map((buffer) => ({
    base64: buffer.toString('base64'),
    mimeType: 'image/jpeg'
  }))
}

export class LLMClient {
  private getClient(): OpenAI {
    const config = configService.load().llm
    return new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      timeout: config.timeoutMs
    })
  }

  async prepareImage(filePath: string): Promise<{ base64: string; mimeType: string }> {
    const maxEdge = configService.load().analysis.maxImageEdgePx
    const buffer = await sharp(filePath)
      .rotate()
      .resize(maxEdge, maxEdge, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer()
    return { base64: buffer.toString('base64'), mimeType: 'image/jpeg' }
  }

  async prepareVideoFrames(filePath: string): Promise<Array<{ base64: string; mimeType: string }>> {
    const analysis = configService.load().analysis
    const rawFrames = await extractVideoFrames(filePath, analysis.videoFrameCount)
    const resized: Buffer[] = []
    for (const raw of rawFrames) {
      resized.push(await resizeFrameBuffer(raw, analysis.maxImageEdgePx))
    }
    const padded = padFrameBuffers(resized, analysis.sequenceMinFrames)
    return buffersToFramePayloads(padded)
  }

  async prepareGifFrames(filePath: string): Promise<Array<{ base64: string; mimeType: string }>> {
    const analysis = configService.load().analysis
    const rawFrames = await extractGifFrames(filePath, analysis.gifFrameCount, analysis.maxImageEdgePx)
    const padded = padFrameBuffers(rawFrames, analysis.sequenceMinFrames)
    return buffersToFramePayloads(padded)
  }

  async analyzeImage(imageBase64: string, mimeType: string): Promise<ImageAnalysisPayload> {
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
    return mapPayload(raw)
  }

  /** 使用百炼 OpenAI 兼容 video 帧序列 API（图像列表形式） */
  async analyzeFrameSequence(
    frames: Array<{ base64: string; mimeType: string }>,
    kind: SequenceKind
  ): Promise<ImageAnalysisPayload> {
    const config = configService.load()
    const prompt = kind === 'gif' ? promptBuilder.loadGifPrompt() : promptBuilder.loadVideoPrompt()
    const client = this.getClient()
    const userText = prompt.user_template.replace('{{frame_count}}', String(frames.length))
    const fps = config.analysis.sequenceFrameFps

    const videoPart = {
      type: 'video',
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
    return mapPayload(raw)
  }
}

export interface AnalyzeFileResult {
  payload: ImageAnalysisPayload
  promptVersion: string
}

export class ImageAnalyzer {
  constructor(private readonly llm: LLMClient = new LLMClient()) {}

  async analyzeFile(filePath: string): Promise<AnalyzeFileResult> {
    const config = configService.load()

    if (isVideoFile(filePath)) {
      const frames = await this.llm.prepareVideoFrames(filePath)
      const payload = await this.llm.analyzeFrameSequence(frames, 'video')
      return { payload, promptVersion: config.analysis.videoPromptVersion }
    }

    if (isGifFile(filePath)) {
      const frames = await this.llm.prepareGifFrames(filePath)
      const payload = await this.llm.analyzeFrameSequence(frames, 'gif')
      return { payload, promptVersion: config.analysis.gifPromptVersion }
    }

    const { base64, mimeType } = await this.llm.prepareImage(filePath)
    const payload = await this.llm.analyzeImage(base64, mimeType)
    return { payload, promptVersion: config.analysis.promptVersion }
  }
}

export const llmClient = new LLMClient()
export const imageAnalyzer = new ImageAnalyzer()
