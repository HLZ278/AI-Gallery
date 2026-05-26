import type { ImageGenAcceptResult, ImageGenResult } from '../../shared/types'
import { toFileUrl } from '../../utils/fileUrl'

export type GenerationDecision = 'pending' | 'accepted' | 'rejected'

interface Props {
  result: ImageGenResult
  status: GenerationDecision
  acceptResult?: ImageGenAcceptResult
  busy?: boolean
  onAccept: () => void
  onReject: () => void
}

export function ImageGenResultCard({
  result,
  status,
  acceptResult,
  busy,
  onAccept,
  onReject
}: Props) {
  const previewPath =
    status === 'accepted' && acceptResult?.filePath
      ? acceptResult.filePath
      : result.tempFilePath
  const previewUrl = toFileUrl(previewPath)

  return (
    <div className="mt-3 rounded-apple overflow-hidden border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm max-w-md">
      <div className="aspect-square bg-black/5 dark:bg-white/5 overflow-hidden">
        <img
          src={previewUrl}
          alt={result.prompt}
          className="w-full h-full object-contain"
          draggable={false}
        />
      </div>
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-2 text-[10px] text-[var(--color-muted)]">
          <span>
            目标图库 · {result.libraryName}
          </span>
          {result.width > 0 && result.height > 0 && (
            <span>{result.width} × {result.height}</span>
          )}
        </div>

        {status === 'pending' ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onAccept}
              disabled={busy}
              className="flex-1 py-2 rounded-apple-sm bg-[var(--color-accent)] text-white text-xs font-medium disabled:opacity-50"
            >
              {busy ? '保存中...' : '接受并保存'}
            </button>
            <button
              type="button"
              onClick={onReject}
              disabled={busy}
              className="flex-1 py-2 rounded-apple-sm border border-[var(--color-border)] text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50"
            >
              拒绝
            </button>
          </div>
        ) : status === 'accepted' ? (
          <p className="text-xs text-[var(--color-accent)]">
            已保存到「{acceptResult?.libraryName ?? result.libraryName}」
            {acceptResult?.imported ? '，已加入图库并排队分析' : ''}
          </p>
        ) : (
          <p className="text-xs text-[var(--color-muted)]">已拒绝，临时文件已删除</p>
        )}
      </div>
    </div>
  )
}
