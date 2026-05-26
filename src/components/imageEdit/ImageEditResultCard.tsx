import type { ImageEditAcceptResult, ImageEditOverwriteResult, ImageEditResult } from '../../shared/types'
import { toFileUrl } from '../../utils/fileUrl'

export type ImageEditDecision = 'pending' | 'saved' | 'overwritten' | 'rejected'

interface Props {
  edit: ImageEditResult
  status: ImageEditDecision
  acceptResult?: ImageEditAcceptResult
  overwriteResult?: ImageEditOverwriteResult
  busy?: boolean
  onSaveAsNew: () => void
  onOverwrite: () => void
  onReject: () => void
}

export function ImageEditResultCard({
  edit,
  status,
  acceptResult,
  overwriteResult,
  busy,
  onSaveAsNew,
  onOverwrite,
  onReject
}: Props) {
  const previewPath =
    status === 'saved' && acceptResult?.filePath
      ? acceptResult.filePath
      : status === 'overwritten' && overwriteResult?.filePath
        ? overwriteResult.filePath
        : edit.tempFilePath

  return (
    <div className="mt-3 rounded-apple overflow-hidden border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm max-w-lg">
      <div className="grid grid-cols-2 gap-px bg-[var(--color-border)]">
        {edit.sourceFilePaths.map((path, index) => (
          <div key={path} className="bg-[var(--color-card)]">
            <p className="px-2 py-1 text-[10px] text-[var(--color-muted)] truncate">
              原图{edit.sourceFilePaths.length > 1 ? ` ${index + 1}` : ''} · {edit.sourceFileNames[index]}
            </p>
            <div className="aspect-square bg-black/5 dark:bg-white/5 overflow-hidden">
              <img src={toFileUrl(path)} alt="" className="w-full h-full object-contain" draggable={false} />
            </div>
          </div>
        ))}
        <div className={`bg-[var(--color-card)] ${edit.sourceFilePaths.length === 1 ? '' : 'col-span-2'}`}>
          <p className="px-2 py-1 text-[10px] text-[var(--color-accent)]">编辑结果</p>
          <div className="aspect-square bg-black/5 dark:bg-white/5 overflow-hidden">
            <img src={toFileUrl(previewPath)} alt="" className="w-full h-full object-contain" draggable={false} />
          </div>
        </div>
      </div>

      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-2 text-[10px] text-[var(--color-muted)]">
          <span>图库 · {edit.libraryName}</span>
          {edit.width > 0 && edit.height > 0 && <span>{edit.width} × {edit.height}</span>}
        </div>

        {status === 'pending' ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onSaveAsNew}
              disabled={busy}
              className="flex-1 min-w-[88px] py-2 rounded-apple-sm bg-[var(--color-accent)] text-white text-xs font-medium disabled:opacity-50"
            >
              {busy ? '处理中...' : '入库'}
            </button>
            <button
              type="button"
              onClick={onOverwrite}
              disabled={busy}
              className="flex-1 min-w-[88px] py-2 rounded-apple-sm border border-[var(--color-accent)] text-[var(--color-accent)] text-xs font-medium disabled:opacity-50"
            >
              覆盖原图
            </button>
            <button
              type="button"
              onClick={onReject}
              disabled={busy}
              className="flex-1 min-w-[88px] py-2 rounded-apple-sm border border-[var(--color-border)] text-xs font-medium disabled:opacity-50"
            >
              拒绝
            </button>
          </div>
        ) : status === 'saved' ? (
          <p className="text-xs text-[var(--color-accent)]">
            已作为新图片保存到「{acceptResult?.libraryName ?? edit.libraryName}」
          </p>
        ) : status === 'overwritten' ? (
          <p className="text-xs text-[var(--color-accent)]">
            已覆盖原图并重新排队分析
          </p>
        ) : (
          <p className="text-xs text-[var(--color-muted)]">已拒绝，临时文件已删除</p>
        )}
      </div>
    </div>
  )
}
