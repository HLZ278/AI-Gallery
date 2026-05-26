import { useMemo } from 'react'
import type { MediaItem } from '../../shared/types'
import { groupMediaForTimeline, resolveTimelineGranularity } from '../utils/timelineGroup'
import type { MediaSortField } from '../utils/mediaSort'
import { MediaGridItem } from './MediaGrid'

interface Props {
  items: MediaItem[]
  sortField: MediaSortField
  selectedIds?: Set<string>
  focusId?: string | null
  onSelect?: (item: MediaItem, e: React.MouseEvent) => void
  onDoubleClick?: (item: MediaItem) => void
  onContextMenu?: (item: MediaItem, e: React.MouseEvent) => void
  scoreMap?: Record<string, number>
}

export function MediaTimeline({
  items,
  sortField,
  selectedIds,
  focusId,
  onSelect,
  onDoubleClick,
  onContextMenu,
  scoreMap
}: Props) {
  const groups = useMemo(() => {
    const granularity = resolveTimelineGranularity(items, sortField)
    return groupMediaForTimeline(items, sortField, granularity)
  }, [items, sortField])

  if (items.length === 0) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center text-[var(--color-muted)]">
        暂无图片，请先添加图库或导入图片
      </div>
    )
  }

  return (
    <div className="flex-1 min-w-0 min-h-0 overflow-y-auto outline-none" tabIndex={-1}>
      <div className="relative px-4 py-6">
        <div
          className="absolute left-[1.375rem] top-8 bottom-8 w-0.5 bg-[var(--color-border)]"
          aria-hidden
        />

        <div className="space-y-10">
          {groups.map((group) => (
            <section key={group.key} className="relative pl-10">
              <div
                className="absolute left-3 top-3 w-3 h-3 rounded-full bg-[var(--color-accent)] ring-4 ring-[var(--color-bg)] z-10"
                aria-hidden
              />

              <div className="sticky top-0 z-20 -ml-10 pl-10 py-2 mb-3 bg-[var(--color-bg)]/85 backdrop-blur-md border-b border-[var(--color-border)]/60">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-sm font-semibold">{group.label}</h3>
                  <span className="text-xs text-[var(--color-muted)]">{group.items.length} 项</span>
                </div>
              </div>

              <div
                className="grid gap-3 items-start content-start"
                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(140px, 100%), 1fr))' }}
              >
                {group.items.map((item) => (
                  <MediaGridItem
                    key={item.id}
                    item={item}
                    selected={selectedIds?.has(item.id)}
                    focused={item.id === focusId}
                    score={scoreMap?.[item.id]}
                    onClick={(e) => onSelect?.(item, e)}
                    onDoubleClick={() => onDoubleClick?.(item)}
                    onContextMenu={(e) => onContextMenu?.(item, e)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
