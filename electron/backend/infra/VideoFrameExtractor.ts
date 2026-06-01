import { spawn } from 'child_process'
import { mkdtemp, readFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { app } from 'electron'
import ffmpegStatic from 'ffmpeg-static'
import { parseFile } from 'music-metadata'
import sharp from 'sharp'
import { getExtension, VIDEO_EXTENSIONS } from '../domain/MediaClassifier'
import { APP_FILE_PREFIX } from '../../../shared/appMeta'

const DEFAULT_FRAME_COUNT = 3

function getFfmpegPath(): string {
  if (!ffmpegStatic) throw new Error('未找到 ffmpeg，无法分析视频')
  if (app.isPackaged) {
    return ffmpegStatic.replace('app.asar', 'app.asar.unpacked')
  }
  return ffmpegStatic
}

export function isVideoFile(filePath: string): boolean {
  return VIDEO_EXTENSIONS.has(getExtension(filePath))
}

async function getDurationSec(filePath: string): Promise<number> {
  try {
    const meta = await parseFile(filePath, { duration: true })
    if (meta.format.duration != null && meta.format.duration > 0) return meta.format.duration
  } catch {
    /* fallback */
  }
  return 10
}

function buildSeekPoints(durationSec: number, count: number): number[] {
  if (durationSec <= 0.5) return [0]
  if (count <= 1) return [Math.min(0.5, durationSec * 0.1)]

  const margin = Math.min(0.5, durationSec * 0.05)
  const start = margin
  const end = Math.max(margin, durationSec - margin)
  if (end <= start) return [0]

  const points: number[] = []
  for (let i = 0; i < count; i++) {
    const ratio = count === 1 ? 0.5 : i / (count - 1)
    points.push(start + (end - start) * ratio)
  }
  return [...new Set(points.map((p) => Math.round(p * 100) / 100))]
}

async function runFfmpeg(args: string[]): Promise<void> {
  const ffmpeg = getFfmpegPath()
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(ffmpeg, args, { windowsHide: true })
    let stderr = ''
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg 抽帧失败 (code ${code}): ${stderr.slice(-200)}`))
    })
  })
}

export async function extractVideoFrameToFile(videoPath: string, seekSec: number, outputPath: string): Promise<void> {
  try {
    await runFfmpeg([
      '-hide_banner',
      '-loglevel',
      'error',
      '-ss',
      String(seekSec),
      '-i',
      videoPath,
      '-frames:v',
      '1',
      '-q:v',
      '2',
      '-y',
      outputPath
    ])
  } catch {
    await runFfmpeg([
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      videoPath,
      '-ss',
      String(seekSec),
      '-frames:v',
      '1',
      '-q:v',
      '2',
      '-y',
      outputPath
    ])
  }
}

export async function extractVideoFrames(videoPath: string, frameCount = DEFAULT_FRAME_COUNT): Promise<Buffer[]> {
  const durationSec = await getDurationSec(videoPath)
  const seeks = buildSeekPoints(durationSec, frameCount)
  const tempDir = await mkdtemp(join(tmpdir(), `${APP_FILE_PREFIX}-frames-`))
  const frames: Buffer[] = []

  try {
    for (let i = 0; i < seeks.length; i++) {
      const outPath = join(tempDir, `frame-${i}.jpg`)
      try {
        await extractVideoFrameToFile(videoPath, seeks[i], outPath)
        frames.push(await readFile(outPath))
      } catch (err) {
        if (i === 0) throw err
        console.warn(`Skip video frame at ${seeks[i]}s:`, err)
      }
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {})
  }

  if (frames.length === 0) throw new Error('无法从视频中抽取有效画面')
  return frames
}

export async function extractVideoThumbnail(videoPath: string, outputPath: string): Promise<boolean> {
  try {
    const durationSec = await getDurationSec(videoPath)
    const seek = Math.min(1, durationSec * 0.1)
    await extractVideoFrameToFile(videoPath, seek, outputPath)
    return true
  } catch {
    return false
  }
}

export async function resizeFrameBuffer(buffer: Buffer, maxEdge: number): Promise<Buffer> {
  return sharp(buffer).rotate().resize(maxEdge, maxEdge, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer()
}
