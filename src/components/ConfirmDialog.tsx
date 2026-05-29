import { useConfirmStore } from '../store/confirmStore'

export function ConfirmDialog() {
  const open = useConfirmStore((s) => s.open)
  const options = useConfirmStore((s) => s.options)
  const close = useConfirmStore((s) => s.close)

  if (!open || !options) return null

  const title = options.title ?? '确认操作'
  const confirmLabel = options.confirmLabel ?? '确定'
  const cancelLabel = options.cancelLabel ?? '取消'

  return (
    <div
      className="fixed inset-0 z-[30000] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={() => close(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="w-full max-w-md mx-4 p-6 rounded-apple bg-[var(--color-card)] border border-[var(--color-border)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className="text-lg font-semibold mb-2">
          {title}
        </h2>
        <p className="text-sm text-[var(--color-muted)] leading-relaxed whitespace-pre-wrap">{options.message}</p>
        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={() => close(false)}
            className="px-4 py-2 rounded-apple-sm border border-[var(--color-border)] text-sm hover:bg-black/5 dark:hover:bg-white/5"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => close(true)}
            className={`px-4 py-2 rounded-apple-sm text-white text-sm font-medium ${
              options.danger ? 'bg-red-500 hover:bg-red-600' : 'bg-[var(--color-accent)] hover:brightness-110'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
