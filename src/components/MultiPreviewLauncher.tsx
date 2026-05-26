import type { MediaItem } from '../../shared/types'
import { isMultiPreviewable } from './preview/multiLayout'

interface Props {
  selected: MediaItem | null
  selectedItems: MediaItem[]
  onLaunchSelected: () => void
  onLaunchWindow: (count: number) => void
}

const COUNT_OPTIONS = [1, 2, 3, 4, 5, 6] as const

export function MultiPreviewLauncher({ selected, selectedItems, onLaunchSelected, onLaunchWindow }: Props) {
  const previewableSelected = selectedItems.filter((i) => isMultiPreviewable(i.mediaType))
  const multiCount = previewableSelected.length

  if (!selected && multiCount === 0) return null

  const showWindowButtons = multiCount <= 1 && selected && isMultiPreviewable(selected.mediaType)
  const showSelectedButton = multiCount >= 2

  if (!showWindowButtons && !showSelectedButton) return null

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-card)]/60 shrink-0 flex-wrap">
      <span className="text-xs text-[var(--color-muted)] shrink-0">多图对比</span>

      {showSelectedButton && (
        <button
          type="button"
          onClick={onLaunchSelected}
          className="px-3 h-8 rounded-lg text-xs font-medium bg-[var(--color-accent)] text-white hover:brightness-110 transition-colors"
          title="对比当前选中的图片/视频"
        >
          对比已选 {multiCount} 项
        </button>
      )}

      {showWindowButtons && (
        <>
          <span className="text-[10px] text-[var(--color-muted)] hidden sm:inline">从当前项起</span>
          <div className="flex items-center gap-1 flex-wrap">
            {COUNT_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onLaunchWindow(n)}
                className="w-8 h-8 rounded-lg text-xs font-medium border border-[var(--color-border)] hover:bg-[var(--color-accent)] hover:text-white hover:border-transparent transition-colors"
                title={`滑动窗口预览 ${n} 项`}
              >
                {n}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
