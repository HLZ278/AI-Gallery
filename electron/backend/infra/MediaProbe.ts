import sharp from 'sharp'
import { parseFile } from 'music-metadata'
import type { MediaType } from '../../../shared/types'

export interface ProbedMeta {
  durationMs: number | null
  frameCount: number | null
  width: number | null
  height: number | null
}

export async function probeMediaMeta(filePath: string, mediaType: MediaType): Promise<ProbedMeta> {
  if (mediaType === 'gif') return probeGif(filePath)
  if (mediaType === 'video') return probeVideo(filePath)
  return { durationMs: null, frameCount: null, width: null, height: null }
}

async function probeGif(filePath: string): Promise<ProbedMeta> {
  try {
    const meta = await sharp(filePath, { animated: true }).metadata()
    const frameCount = meta.pages ?? null
    let durationMs: number | null = null
    if (frameCount && meta.delay != null) {
      const delays = Array.isArray(meta.delay) ? meta.delay : [meta.delay]
      durationMs = delays.reduce((sum, d) => sum + d, 0)
    }
    return {
      durationMs,
      frameCount,
      width: meta.width ?? null,
      height: meta.height ?? null
    }
  } catch {
    return { durationMs: null, frameCount: null, width: null, height: null }
  }
}

async function probeVideo(filePath: string): Promise<ProbedMeta> {
  try {
    const meta = await parseFile(filePath, { duration: true })
    const durationMs = meta.format.duration != null ? Math.round(meta.format.duration * 1000) : null
    const videoTrack = meta.videoTracks?.[0]
    return {
      durationMs,
      frameCount: null,
      width: videoTrack?.width ?? null,
      height: videoTrack?.height ?? null
    }
  } catch {
    return { durationMs: null, frameCount: null, width: null, height: null }
  }
}
