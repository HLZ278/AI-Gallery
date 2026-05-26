import { createPortal } from 'react-dom'
import type { CSSProperties, ReactNode, Ref } from 'react'

const OVERLAY_STYLE: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 10000,
  WebkitAppRegion: 'no-drag'
}

interface Props {
  children: ReactNode
  className?: string
  containerRef?: Ref<HTMLDivElement>
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void
  onContextMenu?: (e: React.MouseEvent<HTMLDivElement>) => void
}

export function PreviewOverlay({ children, className = '', containerRef, onClick, onContextMenu }: Props) {
  return createPortal(
    <div
      ref={containerRef}
      className={className}
      style={OVERLAY_STYLE}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {children}
    </div>,
    document.body
  )
}
