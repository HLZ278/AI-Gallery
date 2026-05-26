import sharp from 'sharp'
import { getExtension } from '../domain/MediaClassifier'
import { resizeFrameBuffer } from './VideoFrameExtractor'

const GIF_EXTENSION = '.gif'

export function isGifFile(filePath: string): boolean {
  return getExtension(filePath) === GIF_EXTENSION
}

function buildFrameIndices(totalPages: number, count: number): number[] {
  if (totalPages <= 0) return [0]
  if (totalPages <= count) {
    return Array.from({ length: totalPages }, (_, i) => i)
  }
  const indices: number[] = []
  for (let i = 0; i < count; i++) {
    const ratio = count === 1 ? 0 : i / (count - 1)
    indices.push(Math.min(totalPages - 1, Math.round(ratio * (totalPages - 1))))
  }
  return [...new Set(indices)]
}

/** 从 GIF 均匀抽取若干帧（JPEG） */
export async function extractGifFrames(gifPath: string, frameCount: number, maxEdge: number): Promise<Buffer[]> {
  const meta = await sharp(gifPath, { animated: true }).metadata()
  const totalPages = Math.max(1, meta.pages ?? 1)
  const indices = buildFrameIndices(totalPages, frameCount)
  const frames: Buffer[] = []

  for (const page of indices) {
    const raw = await sharp(gifPath, { animated: true, page })
      .rotate()
      .resize(maxEdge, maxEdge, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer()
    frames.push(raw)
  }

  if (frames.length === 0) {
    const fallback = await sharp(gifPath).jpeg({ quality: 85 }).toBuffer()
    frames.push(await resizeFrameBuffer(fallback, maxEdge))
  }

  return frames
}
