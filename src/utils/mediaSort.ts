import type { MediaItem } from '../../shared/types'

export type MediaSortField = 'takenAt' | 'importedAt'
export type MediaSortOrder = 'asc' | 'desc'

export function getMediaSortTime(item: MediaItem, field: MediaSortField): number | null {
  if (field === 'importedAt') return item.importedAt
  return item.takenAt ?? item.importedAt
}

export function sortMediaItems(
  items: MediaItem[],
  field: MediaSortField,
  order: MediaSortOrder
): MediaItem[] {
  const dir = order === 'asc' ? 1 : -1
  return [...items].sort((a, b) => {
    const ta = getMediaSortTime(a, field)
    const tb = getMediaSortTime(b, field)
    if (ta == null && tb == null) return 0
    if (ta == null) return 1
    if (tb == null) return -1
    return (ta - tb) * dir
  })
}
