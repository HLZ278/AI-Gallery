import {
  IconClose,
  IconChevronLeft,
  IconChevronRight,
  IconRotateLeft,
  IconRotateRight,
  IconFullscreen,
  IconFullscreenExit
} from './icons'

interface Props {
  fileName: string
  index?: number
  total?: number
  showRotation?: boolean
  showNavigation?: boolean
  isFullscreen?: boolean
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
  onRotateLeft?: () => void
  onRotateRight?: () => void
  onToggleFullscreen?: () => void
}

function ToolbarButton({
  onClick,
  label,
  children,
  className = ''
}: {
  onClick?: () => void
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`w-9 h-9 flex items-center justify-center rounded-full text-white/85 hover:bg-white/15 hover:text-white transition-colors disabled:opacity-30 disabled:pointer-events-none ${className}`}
    >
      {children}
    </button>
  )
}

export function PreviewTopBar({ fileName, index, total, onClose }: Pick<Props, 'fileName' | 'index' | 'total' | 'onClose'>) {
  return (
    <div
      className="absolute top-0 inset-x-0 flex items-center justify-between px-4 py-3 min-h-[52px] bg-gradient-to-b from-black/80 to-transparent pointer-events-auto"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      <div className="w-10 shrink-0" />
      <p className="text-white/90 text-sm font-medium truncate max-w-[50vw] text-center pointer-events-none">
        {fileName}
        {total != null && total > 1 && index != null && (
          <span className="text-white/50 font-normal"> · {index + 1} / {total}</span>
        )}
      </p>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onClose()
        }}
        onMouseDown={(e) => e.stopPropagation()}
        className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors backdrop-blur-md cursor-pointer"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        title="关闭 (Esc)"
        aria-label="关闭"
      >
        <IconClose className="w-4 h-4 pointer-events-none" />
      </button>
    </div>
  )
}

export function PreviewBottomBar({
  showRotation,
  showNavigation,
  isFullscreen,
  onPrev,
  onNext,
  onRotateLeft,
  onRotateRight,
  onToggleFullscreen
}: Pick<
  Props,
  | 'showRotation'
  | 'showNavigation'
  | 'isFullscreen'
  | 'onPrev'
  | 'onNext'
  | 'onRotateLeft'
  | 'onRotateRight'
  | 'onToggleFullscreen'
>) {
  return (
    <div className="absolute bottom-0 inset-x-0 flex items-center justify-center gap-2 px-4 py-4 bg-gradient-to-t from-black/70 to-transparent pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-1 px-2 py-1.5 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/10">
        {showNavigation && (
          <>
            <ToolbarButton onClick={onPrev} label="上一张">
              <IconChevronLeft className="w-5 h-5" />
            </ToolbarButton>
            <ToolbarButton onClick={onNext} label="下一张">
              <IconChevronRight className="w-5 h-5" />
            </ToolbarButton>
            {(showRotation || onToggleFullscreen) && <div className="w-px h-5 bg-white/15 mx-1" />}
          </>
        )}
        {showRotation && (
          <>
            <ToolbarButton onClick={onRotateLeft} label="逆时针旋转">
              <IconRotateLeft />
            </ToolbarButton>
            <ToolbarButton onClick={onRotateRight} label="顺时针旋转">
              <IconRotateRight />
            </ToolbarButton>
            {onToggleFullscreen && <div className="w-px h-5 bg-white/15 mx-1" />}
          </>
        )}
        {onToggleFullscreen && (
          <ToolbarButton onClick={onToggleFullscreen} label={isFullscreen ? '退出全屏' : '全屏'}>
            {isFullscreen ? <IconFullscreenExit /> : <IconFullscreen />}
          </ToolbarButton>
        )}
      </div>
    </div>
  )
}

export function PreviewNavButton({ direction, onClick }: { direction: 'left' | 'right'; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      className={`absolute top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/90 backdrop-blur-md border border-white/10 transition-colors pointer-events-auto ${
        direction === 'left' ? 'left-4' : 'right-4'
      }`}
      aria-label={direction === 'left' ? '上一张' : '下一张'}
    >
      {direction === 'left' ? <IconChevronLeft /> : <IconChevronRight />}
    </button>
  )
}
