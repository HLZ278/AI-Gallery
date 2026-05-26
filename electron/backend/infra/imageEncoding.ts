import { readFileSync, statSync } from 'fs'
import { extname } from 'path'
import sharp from 'sharp'
import type { AppConfig } from '../../../shared/types'

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.bmp': 'image/bmp',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.webp': 'image/webp',
  '.gif': 'image/gif'
}

export interface EncodedImageInput {
  filePath: string
  dataUri: string
  width: number
  height: number
  fileSize: number
}

function normalizeExt(filePath: string): string {
  return extname(filePath).toLowerCase()
}

export function validateImageInput(filePath: string, imageEdit: AppConfig['imageEdit']): void {
  const ext = normalizeExt(filePath)
  const allowed = imageEdit.allowedExtensions.map((e) => e.toLowerCase())
  if (!allowed.includes(ext)) {
    throw new Error(`不支持的图片格式 ${ext || '(无扩展名)'}，支持：${allowed.join('、')}`)
  }

  const { size } = statSync(filePath)
  if (size > imageEdit.maxInputBytes) {
    throw new Error(`图片超过 ${Math.round(imageEdit.maxInputBytes / 1024 / 1024)}MB 限制`)
  }
}

export async function encodeImageForApi(
  filePath: string,
  imageEdit: AppConfig['imageEdit']
): Promise<EncodedImageInput> {
  validateImageInput(filePath, imageEdit)

  const ext = normalizeExt(filePath)
  const mime = MIME_BY_EXT[ext]
  if (!mime) throw new Error(`无法识别图片 MIME：${ext}`)

  const originalBuffer = readFileSync(filePath)
  let buffer: Buffer = originalBuffer
  let outputMime = mime
  let meta = await sharp(buffer, { animated: false }).metadata()
  let width = meta.width ?? 0
  let height = meta.height ?? 0

  const maxEdge = Math.max(width, height)
  if (maxEdge > imageEdit.maxInputEdgePx) {
    buffer = await sharp(buffer, { animated: false })
      .rotate()
      .resize({
        width: width >= height ? imageEdit.maxInputEdgePx : undefined,
        height: height > width ? imageEdit.maxInputEdgePx : undefined,
        fit: 'inside',
        withoutEnlargement: true
      })
      .png()
      .toBuffer()
    outputMime = 'image/png'
    meta = await sharp(buffer).metadata()
    width = meta.width ?? 0
    height = meta.height ?? 0
  }

  const minEdge = Math.min(width, height)
  if (minEdge > 0 && minEdge < imageEdit.minInputEdgePx) {
    throw new Error(`图片分辨率过低（最短边 ${minEdge}px），建议至少 ${imageEdit.minInputEdgePx}px`)
  }

  const dataUri = `data:${outputMime};base64,${buffer.toString('base64')}`

  return {
    filePath,
    dataUri,
    width,
    height,
    fileSize: buffer.length
  }
}
