interface Props {
  count: number
}

export function MediaSelectionBar({ count }: Props) {
  if (count === 0) return null

  return (
    <div className="flex items-center gap-3 px-4 py-1.5 text-[11px] text-[var(--color-muted)] border-b border-[var(--color-border)] bg-[var(--color-card)]/50 shrink-0">
      <span className="text-[var(--color-text)] font-medium">已选 {count} 项</span>
      <span>Ctrl+C 复制</span>
      <span>Ctrl+A 全选</span>
      <span>Enter 预览</span>
      <span>Shift+方向键 扩展选择</span>
      <span>Esc 取消</span>
    </div>
  )
}
