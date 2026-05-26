import type { MediaItem } from '../../shared/types'
import { getMediaSortTime, type MediaSortField } from './mediaSort'

export type TimelineGranularity = 'day' | 'month' | 'year'

export interface TimelineGroup {
  key: string
  label: string
  sortTime: number | null
  items: MediaItem[]
}

const DAY_MS = 86_400_000

function bucketKey(ts: number, granularity: TimelineGranularity): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  if (granularity === 'year') return `${y}`
  if (granularity === 'month') return `${y}-${m}`
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function resolveTimelineGranularity(
  items: MediaItem[],
  sortField: MediaSortField
): TimelineGranularity {
  const times = items
    .map((item) => getMediaSortTime(item, sortField))
    .filter((t): t is number => t != null)

  if (times.length < 2) return 'day'

  const spanDays = (Math.max(...times) - Math.min(...times)) / DAY_MS
  if (spanDays > 730) return 'year'
  if (spanDays > 90) return 'month'
  return 'day'
}

export function formatTimelineGroupLabel(
  key: string,
  granularity: TimelineGranularity
): string {
  if (key === 'unknown') return '未知时间'

  if (granularity === 'year') {
    return `${key} 年`
  }

  const [y, m, d] = key.split('-').map(Number)
  if (granularity === 'month') {
    return `${y} 年 ${m} 月`
  }

  const date = new Date(y, m - 1, d)
  const weekday = date.toLocaleDateString('zh-CN', { weekday: 'long' })
  return `${y} 年 ${m} 月 ${d} 日 · ${weekday}`
}

export function groupMediaForTimeline(
  items: MediaItem[],
  sortField: MediaSortField,
  granularity: TimelineGranularity
): TimelineGroup[] {
  const groups: TimelineGroup[] = []
  const unknownItems: MediaItem[] = []

  for (const item of items) {
    const time = getMediaSortTime(item, sortField)
    if (time == null) {
      unknownItems.push(item)
      continue
    }

    const key = bucketKey(time, granularity)
    let group = groups.find((g) => g.key === key)
    if (!group) {
      group = {
        key,
        label: formatTimelineGroupLabel(key, granularity),
        sortTime: time,
        items: []
      }
      groups.push(group)
    }
    group.items.push(item)
  }

  if (unknownItems.length > 0) {
    groups.push({
      key: 'unknown',
      label: formatTimelineGroupLabel('unknown', granularity),
      sortTime: null,
      items: unknownItems
    })
  }

  return groups
}
