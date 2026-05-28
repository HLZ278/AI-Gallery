interface Props {
  count: number
  onEnhanceBatch?: () => void
  enhanceBusy?: boolean
}

export function MediaSelectionBar({ count, onEnhanceBatch, enhanceBusy }: Props) {
  if (count === 0) return null

  return (
    <div className="flex items-center gap-3 px-4 py-1.5 text-[11px] text-[var(--color-muted)] border-b border-[var(--color-border)] bg-[var(--color-card)]/50 shrink-0">
      <span className="text-[var(--color-text)] font-medium">已选 {count} 项</span>
      {onEnhanceBatch && count > 0 && (
        <button
          type="button"
          onClick={onEnhanceBatch}
          disabled={enhanceBusy}
          className="px-2.5 py-0.5 rounded-full border border-[var(--color-accent)] text-[var(--color-accent)] disabled:opacity-50"
        >
          {enhanceBusy ? '提交中...' : '批量云端增强'}
        </button>
      )}
      <span>Ctrl+C 复制</span>
      <span>Ctrl+A 全选</span>
      <span>Enter 预览</span>
      <span>Shift+方向键 扩展选择</span>
      <span>Esc 取消</span>
    </div>
  )
}
