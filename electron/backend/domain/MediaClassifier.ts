import { join } from 'path'
import { app } from 'electron'
import { existsSync, mkdirSync } from 'fs'
import type { MediaType } from '../../../shared/types'

const IMAGE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff', '.tif', '.heic', '.heif'
])
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'])
const GIF_EXTENSION = '.gif'

export function getThumbsDir(): string {
  const dir = join(app.getPath('userData'), 'thumbnails')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function getExtension(filePath: string): string {
  const idx = filePath.lastIndexOf('.')
  return idx >= 0 ? filePath.slice(idx).toLowerCase() : ''
}

export function isMediaFile(filePath: string): boolean {
  const ext = getExtension(filePath)
  return IMAGE_EXTENSIONS.has(ext) || VIDEO_EXTENSIONS.has(ext) || ext === GIF_EXTENSION
}

export interface ClassifyInput {
  filePath: string
  width: number
  height: number
  exif?: Record<string, unknown>
  siblingFiles?: string[]
}

export class MediaClassifier {
  classify(input: ClassifyInput): MediaType {
    const ext = getExtension(input.filePath)
    if (VIDEO_EXTENSIONS.has(ext)) return 'video'
    if (ext === GIF_EXTENSION) return 'gif'
    if (this.isLivePhoto(input)) return 'live_photo'
    if (this.isPanorama(input)) return 'panorama'
    return 'photo'
  }

  private isLivePhoto(input: ClassifyInput): boolean {
    const base = input.filePath.replace(/\.[^.]+$/, '')
    const movPath = `${base}.mov`
    const MOVPath = `${base}.MOV`
    if (input.siblingFiles?.some((f) => f === movPath || f === MOVPath)) return true
    const contentId = input.exif?.ContentIdentifier ?? input.exif?.contentIdentifier
    return Boolean(contentId)
  }

  private isPanorama(input: ClassifyInput): boolean {
    if (input.width > 0 && input.height > 0 && input.width / input.height > 2.5) return true
    const projection = input.exif?.ProjectionType ?? input.exif?.projectionType
    return typeof projection === 'string' && projection.toLowerCase().includes('pannini')
  }

  detectBurstGroups(
    items: Array<{ id: string; filePath: string; takenAt: number | null }>
  ): Map<string, string[]> {
    const sorted = [...items]
      .filter((i) => i.takenAt)
      .sort((a, b) => (a.takenAt ?? 0) - (b.takenAt ?? 0))

    const groups = new Map<string, string[]>()
    let current: string[] = []
    let lastTime = 0
    let groupIdx = 0

    for (const item of sorted) {
      const t = item.takenAt ?? 0
      if (current.length === 0 || t - lastTime < 2000) {
        current.push(item.id)
      } else {
        if (current.length >= 3) {
          groups.set(`burst-${groupIdx++}`, [...current])
        }
        current = [item.id]
      }
      lastTime = t
    }
    if (current.length >= 3) {
      groups.set(`burst-${groupIdx}`, current)
    }
    return groups
  }
}

export const mediaClassifier = new MediaClassifier()

export { IMAGE_EXTENSIONS, VIDEO_EXTENSIONS, GIF_EXTENSION }
