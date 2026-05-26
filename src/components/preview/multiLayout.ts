import type { MediaItem, MediaType } from '../../../shared/types'

const IMAGE_TYPES: MediaType[] = ['photo', 'gif', 'live_photo', 'panorama', 'burst']
const MULTI_PREVIEW_TYPES: MediaType[] = [...IMAGE_TYPES, 'video']

export function isPreviewableImage(mediaType: MediaType): boolean {
  return IMAGE_TYPES.includes(mediaType)
}

export function isMultiPreviewable(mediaType: MediaType): boolean {
  return MULTI_PREVIEW_TYPES.includes(mediaType)
}

export function filterMultiPreviewItems(items: MediaItem[]): MediaItem[] {
  return items.filter((i) => isMultiPreviewable(i.mediaType))
}

/** @deprecated 使用 filterMultiPreviewItems */
export function filterPreviewableImages(items: MediaItem[]): MediaItem[] {
  return filterMultiPreviewItems(items)
}

export function sliceImagesFrom(items: MediaItem[], startItemId: string, count: number): MediaItem[] {
  const previewable = filterMultiPreviewItems(items)
  const idx = previewable.findIndex((i) => i.id === startItemId)
  if (idx < 0) return []
  const size = Math.min(Math.max(count, 1), 6)
  return previewable.slice(idx, idx + size)
}

export function findWindowStartIndex(items: MediaItem[], startItemId: string): number {
  const previewable = filterMultiPreviewItems(items)
  const idx = previewable.findIndex((i) => i.id === startItemId)
  return Math.max(0, idx)
}

export function getWindowAt(
  items: MediaItem[],
  startIndex: number,
  windowSize: number
): { window: MediaItem[]; startIndex: number; total: number } {
  const previewable = filterMultiPreviewItems(items)
  const size = Math.min(Math.max(windowSize, 1), 6)
  const maxStart = Math.max(0, previewable.length - size)
  const clampedStart = Math.min(Math.max(startIndex, 0), maxStart)
  return {
    window: previewable.slice(clampedStart, clampedStart + size),
    startIndex: clampedStart,
    total: previewable.length
  }
}

export function canShiftWindow(startIndex: number, windowSize: number, total: number, direction: 'prev' | 'next'): boolean {
  const size = Math.min(Math.max(windowSize, 1), 6)
  if (direction === 'prev') return startIndex > 0
  return startIndex + size < total
}

export function shiftWindowStart(startIndex: number, direction: 'prev' | 'next'): number {
  return direction === 'prev' ? startIndex - 1 : startIndex + 1
}

export function multiPreviewLayoutClass(count: number): string {
  if (count <= 1) return 'multi-preview-1'
  if (count === 2) return 'multi-preview-2'
  if (count === 3) return 'multi-preview-3'
  if (count === 4) return 'multi-preview-4'
  if (count === 5) return 'multi-preview-5'
  return 'multi-preview-6'
}
