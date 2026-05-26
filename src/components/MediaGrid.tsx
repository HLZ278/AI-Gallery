import type { MediaItem } from '../../shared/types'
import { MediaTypeBadge, StatusDot } from './MediaBadge'
import { MediaThumbnail } from './MediaThumbnail'

interface Props {
  item: MediaItem
  onClick?: (e: React.MouseEvent) => void
  onDoubleClick?: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  selected?: boolean
  focused?: boolean
  score?: number
}

export function MediaGridItem({ item, onClick, onDoubleClick, onContextMenu, selected, focused, score }: Props) {
  return (
    <button
      type="button"
      data-media-id={item.id}
      onClick={onClick}
      onDoubleClick={(e) => {
        e.preventDefault()
        onDoubleClick?.()
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu?.(e)
      }}
      className={`group relative block w-full aspect-square rounded-apple overflow-hidden bg-[var(--color-card)] border transition-shadow duration-200 hover:shadow-lg hover:z-10 ${
        selected
          ? focused
            ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]'
            : 'border-[var(--color-accent)]/80 ring-2 ring-[var(--color-accent)]/40'
          : 'border-[var(--color-border)]'
      }`}
    >
      <div className="absolute inset-0 overflow-hidden">
        <MediaThumbnail item={item} className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.03]" />
      </div>
      {selected && (
        <div className="absolute top-2 left-2 z-20 w-5 h-5 rounded-full bg-[var(--color-accent)] text-white text-[10px] flex items-center justify-center pointer-events-none shadow">
          ✓
        </div>
      )}
      <div className={`absolute top-2 ${selected ? 'left-9' : 'left-2'} z-10 pointer-events-none transition-all`}>
        <StatusDot status={item.analysisStatus} />
      </div>
      <div className="absolute top-2 right-2 z-10 flex flex-col items-end gap-1 pointer-events-none">
        <MediaTypeBadge type={item.mediaType} />
        {score != null && (
          <span className="px-1.5 py-0.5 text-[10px] rounded bg-[var(--color-accent)] text-white">
            {(score * 100).toFixed(0)}%
          </span>
        )}
      </div>
      {item.takenAt && (
        <div className="absolute bottom-0 inset-x-0 z-10 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <span className="text-white text-[10px]">{new Date(item.takenAt).toLocaleDateString('zh-CN')}</span>
        </div>
      )}
    </button>
  )
}

interface GridProps {
  items: MediaItem[]
  selectedIds?: Set<string>
  focusId?: string | null
  onSelect?: (item: MediaItem, e: React.MouseEvent) => void
  onDoubleClick?: (item: MediaItem) => void
  onContextMenu?: (item: MediaItem, e: React.MouseEvent) => void
  scoreMap?: Record<string, number>
}

export function MediaGrid({
  items,
  selectedIds,
  focusId,
  onSelect,
  onDoubleClick,
  onContextMenu,
  scoreMap
}: GridProps) {
  if (items.length === 0) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center text-[var(--color-muted)]">
        暂无图片，请先添加图库或导入图片
      </div>
    )
  }

  return (
    <div className="flex-1 min-w-0 min-h-0 overflow-y-auto outline-none" tabIndex={-1}>
      <div
        className="grid gap-3 p-4 items-start content-start"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(160px, 100%), 1fr))' }}
      >
        {items.map((item) => (
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
    </div>
  )
}
