import sharp from 'sharp'
import { configService } from '../services/ConfigService'
import { extractVideoFrames, isVideoFile, resizeFrameBuffer } from './VideoFrameExtractor'
import { extractGifFrames, isGifFile } from './GifFrameExtractor'
import { padFrameBuffers } from './frameSequenceUtils'

export type PreparedMedia =
  | { kind: 'image'; buffer: Buffer }
  | { kind: 'frames'; buffers: Buffer[] }

export class MediaPreprocessor {
  async prepare(filePath: string): Promise<PreparedMedia> {
    if (isVideoFile(filePath)) {
      const analysis = configService.load().analysis
      const rawFrames = await extractVideoFrames(filePath, analysis.videoFrameCount)
      const resized: Buffer[] = []
      for (const raw of rawFrames) {
        resized.push(await resizeFrameBuffer(raw, analysis.maxImageEdgePx))
      }
      return { kind: 'frames', buffers: padFrameBuffers(resized, analysis.sequenceMinFrames) }
    }

    if (isGifFile(filePath)) {
      const analysis = configService.load().analysis
      const rawFrames = await extractGifFrames(filePath, analysis.gifFrameCount, analysis.maxImageEdgePx)
      return { kind: 'frames', buffers: padFrameBuffers(rawFrames, analysis.sequenceMinFrames) }
    }

    const buffer = await this.resizeImage(filePath)
    return { kind: 'image', buffer }
  }

  async prepareImageBase64(filePath: string): Promise<{ base64: string; mimeType: string }> {
    const buffer = await this.resizeImage(filePath)
    return { base64: buffer.toString('base64'), mimeType: 'image/jpeg' }
  }

  async prepareVideoFrames(filePath: string): Promise<Array<{ base64: string; mimeType: string }>> {
    const prepared = await this.prepare(filePath)
    if (prepared.kind !== 'frames') throw new Error('Expected video frames')
    return buffersToFramePayloads(prepared.buffers)
  }

  async prepareGifFrames(filePath: string): Promise<Array<{ base64: string; mimeType: string }>> {
    const prepared = await this.prepare(filePath)
    if (prepared.kind !== 'frames') throw new Error('Expected gif frames')
    return buffersToFramePayloads(prepared.buffers)
  }

  async resizeImage(filePath: string): Promise<Buffer> {
    const maxEdge = configService.load().analysis.maxImageEdgePx
    return sharp(filePath)
      .rotate()
      .resize(maxEdge, maxEdge, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer()
  }

  async extractDominantColors(buffer: Buffer): Promise<string[]> {
    try {
      const { dominant } = await sharp(buffer).stats()
      const toHex = (c: { r: number; g: number; b: number }) =>
        `#${[c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`
      const colors: string[] = []
      if (dominant) colors.push(toHex(dominant))
      return colors.slice(0, 3)
    } catch {
      return []
    }
  }
}

function buffersToFramePayloads(buffers: Buffer[]): Array<{ base64: string; mimeType: string }> {
  return buffers.map((buffer) => ({
    base64: buffer.toString('base64'),
    mimeType: 'image/jpeg'
  }))
}

export const mediaPreprocessor = new MediaPreprocessor()
