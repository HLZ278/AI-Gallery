interface Props {
  open: boolean
  onClose: () => void
}

const ROWS: Array<{ keys: string; desc: string }> = [
  { keys: 'Enter / Space', desc: '预览选中图片' },
  { keys: 'Esc', desc: '取消选择 / 关闭详情' },
  { keys: '← → ↑ ↓', desc: '移动选中焦点（Shift 扩展多选）' },
  { keys: 'Ctrl+A', desc: '全选当前结果' },
  { keys: 'Ctrl+C', desc: '复制选中文件' },
  { keys: 'Ctrl+E', desc: '打开所在文件夹' },
  { keys: 'Ctrl+O', desc: '用系统默认程序打开' },
  { keys: 'Ctrl+F', desc: '聚焦搜索框' },
  { keys: '?', desc: '显示快捷键帮助' },
  { keys: '预览：← →', desc: '上一张 / 下一张' },
  { keys: '预览：+ / - / 0', desc: '放大 / 缩小 / 重置缩放' },
  { keys: '预览：R / Shift+R', desc: '顺时针 / 逆时针旋转' },
  { keys: '预览：F / 双击', desc: '全屏' },
  { keys: '预览：Esc', desc: '关闭预览' }
]

export function ShortcutHelpModal({ open, onClose }: Props) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[15000] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-apple bg-[var(--color-card)] border border-[var(--color-border)] shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">快捷键</h2>
          <button type="button" onClick={onClose} className="text-[var(--color-muted)] hover:text-[var(--color-text)]">
            ✕
          </button>
        </div>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto text-sm">
          {ROWS.map((row) => (
            <div key={row.keys} className="flex justify-between gap-4">
              <kbd className="shrink-0 text-xs px-2 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono">{row.keys}</kbd>
              <span className="text-[var(--color-muted)] text-right">{row.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
