import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MediaItem } from '../../shared/types'
import { fileNameFromPath } from '../utils/fileUrl'
import { MultiPreviewCell } from './MultiPreviewCell'
import {
  canShiftWindow,
  findWindowStartIndex,
  getWindowAt,
  multiPreviewLayoutClass,
  shiftWindowStart
} from './preview/multiLayout'
import { PreviewTopBar, PreviewNavButton } from './preview/PreviewToolbar'
import { PreviewOverlay } from './preview/PreviewOverlay'
import { useFullscreen } from './preview/useFullscreen'
import { IconFullscreen, IconFullscreenExit } from './preview/icons'

interface WindowModeProps {
  mode: 'window'
  sourceItems: MediaItem[]
  startItemId: string
  windowSize: number
}

interface SelectedModeProps {
  mode: 'selected'
  items: MediaItem[]
}

type Props = (WindowModeProps | SelectedModeProps) & {
  onClose: () => void
}

export function MultiImagePreviewModal(props: Props) {
  const { onClose } = props
  const containerRef = useRef<HTMLDivElement>(null)
  const { isFullscreen, toggleFullscreen } = useFullscreen(containerRef)
  const isSelectedMode = props.mode === 'selected'

  const [startIndex, setStartIndex] = useState(() => {
    if (props.mode === 'selected') return 0
    return findWindowStartIndex(props.sourceItems, props.startItemId)
  })

  const resolved = useMemo(() => {
    if (props.mode === 'selected') {
      const items = props.items.slice(0, 6)
      return { items, startIndex: 0, total: items.length, windowSize: items.length, slideable: false }
    }
    const windowSize = props.windowSize
    const { window: items, startIndex: clampedStart, total } = getWindowAt(
      props.sourceItems,
      startIndex,
      windowSize
    )
    return { items, startIndex: clampedStart, total, windowSize, slideable: true }
  }, [props, startIndex])

  const { items, startIndex: clampedStart, total, windowSize, slideable } = resolved
  const count = items.length
  const layoutClass = multiPreviewLayoutClass(count)
  const canPrev = slideable && canShiftWindow(clampedStart, windowSize, total, 'prev')
  const canNext = slideable && canShiftWindow(clampedStart, windowSize, total, 'next')

  const goPrev = useCallback(() => {
    if (!canPrev) return
    setStartIndex((i) => shiftWindowStart(i, 'prev'))
  }, [canPrev])

  const goNext = useCallback(() => {
    if (!canNext) return
    setStartIndex((i) => shiftWindowStart(i, 'next'))
  }, [canNext])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullscreen) void document.exitFullscreen()
        else onClose()
        return
      }
      if (e.key === 'f' || e.key === 'F') void toggleFullscreen()
      if (e.key === 'ArrowLeft' && canPrev) goPrev()
      if (e.key === 'ArrowRight' && canNext) goNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, isFullscreen, toggleFullscreen, canPrev, canNext, goPrev, goNext])

  if (count === 0) return null

  const rangeEnd = clampedStart + count
  const title = isSelectedMode
    ? count === 1
      ? fileNameFromPath(items[0].filePath)
      : `已选对比 · ${count} 项`
    : count === 1
      ? fileNameFromPath(items[0].filePath)
      : `多媒体对比 · ${count} 项 (${clampedStart + 1}–${rangeEnd} / ${total})`

  return (
    <PreviewOverlay
      containerRef={containerRef}
      className="flex flex-col bg-[#0a0a0a]/95 select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isFullscreen) onClose()
      }}
    >
      <div className="absolute inset-0 z-[100] pointer-events-none">
        <PreviewTopBar fileName={title} onClose={onClose} />
        {canPrev && <PreviewNavButton direction="left" onClick={goPrev} />}
        {canNext && <PreviewNavButton direction="right" onClick={goNext} />}
      </div>

      <div className="relative z-0 flex-1 min-h-0 p-6 pt-16 pb-20 flex items-center justify-center pointer-events-none">
        <div
          className={`multi-preview-grid ${layoutClass} w-full h-full max-w-[96vw] max-h-[calc(100vh-120px)] pointer-events-auto`}
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item) => (
            <MultiPreviewCell key={item.id} item={item} />
          ))}
        </div>
      </div>

      <div className="absolute bottom-4 inset-x-0 flex justify-center z-[100] pointer-events-none">
        <button
          type="button"
          onClick={() => void toggleFullscreen()}
          className="pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/10 text-white/85 text-xs hover:bg-white/15"
        >
          {isFullscreen ? <IconFullscreenExit className="w-4 h-4" /> : <IconFullscreen className="w-4 h-4" />}
          {isFullscreen ? '退出全屏' : '全屏'}
        </button>
      </div>
    </PreviewOverlay>
  )
}
