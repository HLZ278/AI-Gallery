import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export interface ContextMenuItem {
  id: string
  label: string
  danger?: boolean
  disabled?: boolean
}

interface Props {
  title?: string
  x: number
  y: number
  items: ContextMenuItem[]
  onSelect: (id: string) => void
  onClose: () => void
}

export function ContextMenu({ title, x, y, items, onSelect, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x, top: y })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPos({
      left: x + rect.width > window.innerWidth ? Math.max(8, x - rect.width) : x,
      top: y + rect.height > window.innerHeight ? Math.max(8, y - rect.height) : y
    })
  }, [x, y])

  useEffect(() => {
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[180px] py-1 rounded-apple-sm bg-[var(--color-card)] border border-[var(--color-border)] shadow-xl text-sm"
      style={{ left: pos.left, top: pos.top }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {title && (
        <div className="px-3 py-1.5 text-[10px] text-[var(--color-muted)] truncate border-b border-[var(--color-border)]">
          {title}
        </div>
      )}
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          disabled={item.disabled}
          className={`w-full text-left px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed ${
            item.danger ? 'text-red-500' : ''
          }`}
          onClick={() => onSelect(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
