import { useToastStore } from '../store/toastStore'

export function ToastContainer() {
  const items = useToastStore((s) => s.items)
  const dismiss = useToastStore((s) => s.dismiss)

  if (items.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[20000] flex flex-col gap-2 max-w-sm pointer-events-none">
      {items.map((item) => (
        <div
          key={item.id}
          className={`pointer-events-auto px-4 py-3 rounded-apple shadow-lg border text-sm backdrop-blur-xl ${
            item.kind === 'error'
              ? 'bg-red-500/90 text-white border-red-400/50'
              : item.kind === 'success'
                ? 'bg-green-600/90 text-white border-green-400/50'
                : 'bg-[var(--color-card)]/95 text-[var(--color-text)] border-[var(--color-border)]'
          }`}
        >
          <div className="flex items-start gap-2">
            <p className="flex-1">{item.message}</p>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              className="opacity-70 hover:opacity-100 shrink-0"
              aria-label="关闭"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
