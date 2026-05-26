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
    const updateWidth = () => {
      const width = el.clientWidth
      if (width > 0) setContainerWidth(width)
    }
    updateWidth()
    const observer = new ResizeObserver(() => updateWidth())
    observer.observe(el)
    requestAnimationFrame(updateWidth)
    return () => observer.disconnect()
  }, [items.length])

  const columnCount = useMemo(() => {
    if (containerWidth <= 0) return 0
    const inner = containerWidth - GRID_PADDING * 2
    return Math.max(1, Math.floor((inner + GRID_GAP) / (columnMinWidth + GRID_GAP)))
  }, [containerWidth, columnMinWidth])

  const cellSize = useMemo(() => {
    if (containerWidth <= 0 || columnCount <= 0) return 0
    const inner = containerWidth - GRID_PADDING * 2
    return (inner - GRID_GAP * (columnCount - 1)) / columnCount
  }, [containerWidth, columnCount])

  const rowCount = columnCount > 0 ? Math.ceil(items.length / columnCount) : 0
  const rowHeight = cellSize + GRID_GAP

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 2
  })

  useEffect(() => {
    if (cellSize > 0) rowVirtualizer.measure()
  }, [cellSize, columnCount, items.length])

  const layoutReady = containerWidth > 0 && columnCount > 0 && cellSize > 0

  return (
    <div ref={parentRef} className="flex-1 min-w-0 min-h-0 overflow-y-auto outline-none" tabIndex={-1}>
      {items.length === 0 ? (
        <div className="flex min-h-[200px] items-center justify-center text-[var(--color-muted)] px-6 text-center text-sm">
          {emptyMessage}
        </div>
      ) : layoutReady ? (
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
                className="absolute left-0 right-0 grid items-start"
                style={{
                  top: virtualRow.start + GRID_PADDING,
                  height: cellSize,
                  paddingLeft: GRID_PADDING,
                  paddingRight: GRID_PADDING,
                  gridTemplateColumns: `repeat(${columnCount}, ${cellSize}px)`,
                  gap: GRID_GAP
                }}
              >
                {rowItems.map((item) => (
                  <MediaGridItem
                    key={item.id}
                    item={item}
                    fillCell
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
      ) : null}
    </div>
  )
}

export { MediaGridItem } from './MediaGridItem'
