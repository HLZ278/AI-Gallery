import { useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { MediaItem } from '../../shared/types'
import { MediaGridItem } from './MediaGridItem'

const GRID_GAP = 12
const GRID_PADDING = 16

interface GridProps {
  items: MediaItem[]
  selectedIds?: Set<string>
  focusId?: string | null
  columnMinWidth?: number
  emptyMessage?: string
  onSelect?: (item: MediaItem, e: React.MouseEvent) => void
  onDoubleClick?: (item: MediaItem) => void
  onContextMenu?: (item: MediaItem, e: React.MouseEvent) => void
  scoreMap?: Record<string, number>
}

export function MediaGrid({
  items,
  selectedIds,
  focusId,
  columnMinWidth = 160,
  emptyMessage = '暂无图片，请先添加图库或导入图片',
  onSelect,
  onDoubleClick,
  onContextMenu,
  scoreMap
}: GridProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    const el = parentRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width)
    })
    observer.observe(el)
    setContainerWidth(el.clientWidth)
    return () => observer.disconnect()
  }, [])

  const columnCount = useMemo(() => {
    if (containerWidth <= 0) return 1
    const inner = containerWidth - GRID_PADDING * 2
    return Math.max(1, Math.floor((inner + GRID_GAP) / (columnMinWidth + GRID_GAP)))
  }, [containerWidth, columnMinWidth])

  const rowCount = Math.ceil(items.length / columnCount)
  const cellSize = useMemo(() => {
    if (containerWidth <= 0) return columnMinWidth
    const inner = containerWidth - GRID_PADDING * 2
    return (inner - GRID_GAP * (columnCount - 1)) / columnCount
  }, [containerWidth, columnCount, columnMinWidth])

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => cellSize + GRID_GAP,
    overscan: 2
  })

  if (items.length === 0) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center text-[var(--color-muted)] px-6 text-center text-sm">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div ref={parentRef} className="flex-1 min-w-0 min-h-0 overflow-y-auto outline-none" tabIndex={-1}>
      <div
        style={{
          height: rowVirtualizer.getTotalSize() + GRID_PADDING * 2,
          width: '100%',
          position: 'relative'
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const rowIndex = virtualRow.index
          const rowItems = items.slice(rowIndex * columnCount, rowIndex * columnCount + columnCount)
          return (
            <div
              key={virtualRow.key}
              className="absolute left-0 right-0 grid"
              style={{
                top: virtualRow.start + GRID_PADDING,
                height: cellSize,
                paddingLeft: GRID_PADDING,
                paddingRight: GRID_PADDING,
                gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                gap: GRID_GAP
              }}
            >
              {rowItems.map((item) => (
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
          )
        })}
      </div>
    </div>
  )
}

export { MediaGridItem } from './MediaGridItem'
