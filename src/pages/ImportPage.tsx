import { useState } from 'react'
import { useAppStore } from '../store/appStore'
import { AnalysisProgressPanel } from '../components/AnalysisProgressPanel'
import { LanTransferPanel } from '../components/LanTransferPanel'

export function ImportPage() {
  const libraries = useAppStore((s) => s.libraries)
  const importProgress = useAppStore((s) => s.importProgress)
  const analysisProgress = useAppStore((s) => s.analysisProgress)
  const [libraryId, setLibraryId] = useState('')
  const [importing, setImporting] = useState(false)

  const handleImport = async () => {
    if (!libraryId) {
      alert('请先选择图库')
      return
    }
    const files = await window.api.import.pickFiles()
    if (!files.length) return
    setImporting(true)
    try {
      await window.api.import.files(libraryId, files)
    } finally {
      setImporting(false)
    }
  }

  const progressPercent =
    importProgress && importProgress.total > 0
      ? Math.round((importProgress.processed / importProgress.total) * 100)
      : 0

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold mb-2">导入图片</h1>
      <p className="text-sm text-[var(--color-muted)] mb-6">
        本机选择文件导入，或通过局域网让手机上传 / 下载图库照片
      </p>

      <div className="mb-6">
        <LanTransferPanel />
      </div>

      <div className="space-y-4 p-5 rounded-apple bg-[var(--color-card)] border border-[var(--color-border)]">
        <h2 className="font-semibold text-sm">本机导入</h2>
        <label className="block text-sm font-medium">选择目标图库</label>
        <select
          value={libraryId}
          onChange={(e) => setLibraryId(e.target.value)}
          className="w-full px-3 py-2 rounded-apple-sm bg-[var(--color-bg)] border border-[var(--color-border)] text-sm"
        >
          <option value="">请选择...</option>
          {libraries.map((lib) => (
            <option key={lib.id} value={lib.id}>{lib.name}</option>
          ))}
        </select>

        {libraries.length === 0 && (
          <p className="text-xs text-orange-500">请先在「图库」页面添加一个目录</p>
        )}

        <button
          type="button"
          onClick={handleImport}
          disabled={importing || !libraryId}
          className="w-full py-3 rounded-apple-sm bg-[var(--color-accent)] text-white font-medium disabled:opacity-50"
        >
          {importing ? '导入中...' : '选择文件并导入'}
        </button>
      </div>

      {(importProgress?.phase === 'analyzing' || (analysisProgress && analysisProgress.total > 0 && (analysisProgress.pending > 0 || analysisProgress.processing > 0))) && analysisProgress && (
        <div className="mt-6">
          <AnalysisProgressPanel progress={analysisProgress} />
        </div>
      )}

      {importProgress && importProgress.phase !== 'done' && importProgress.phase !== 'analyzing' && (
        <div className="mt-6 p-5 rounded-apple bg-[var(--color-card)] border border-[var(--color-border)]">
          <div className="flex justify-between text-sm mb-2">
            <span>{importProgress.message}</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-2 rounded-full bg-black/10 overflow-hidden">
            <div
              className="h-full bg-[var(--color-accent)] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {importProgress.currentFile && (
            <p className="text-xs text-[var(--color-muted)] mt-2 truncate">{importProgress.currentFile}</p>
          )}
        </div>
      )}
    </div>
  )
}
