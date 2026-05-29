import { useCallback, useEffect, useRef, useState } from 'react'
import type { Library } from '../../shared/types'
import { AnalysisProgressPanel } from '../components/AnalysisProgressPanel'
import { ContextMenu, type ContextMenuItem } from '../components/ContextMenu'
import { ImportProgressBar } from '../components/ImportProgressBar'
import { formatFileSize } from '../utils/formatMedia'
import { useAppStore } from '../store/appStore'
import { confirmAction } from '../store/confirmStore'
import { toast } from '../store/toastStore'

const LIBRARY_MENU: ContextMenuItem[] = [
  { id: 'openLocation', label: '打开所在位置' },
  { id: 'scan', label: '扫描目录' },
  { id: 'startAnalysis', label: '开始分析待处理项' },
  { id: 'remove', label: '删除图库', danger: true }
]

export function LibraryPage() {
  const libraries = useAppStore((s) => s.libraries)
  const setLibraries = useAppStore((s) => s.setLibraries)
  const analysisProgress = useAppStore((s) => s.analysisProgress)
  const importProgress = useAppStore((s) => s.importProgress)
  const [scanning, setScanning] = useState<string | null>(null)
  const [analysisStarting, setAnalysisStarting] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ library: Library; x: number; y: number } | null>(null)
  const prevAnalysisRunningRef = useRef(false)

  const refresh = useCallback(async () => {
    setLibraries(await window.api.library.list())
  }, [setLibraries])

  useEffect(() => {
    if (!analysisProgress) return
    const wasRunning = prevAnalysisRunningRef.current
    prevAnalysisRunningRef.current = analysisProgress.isRunning
    if (wasRunning && !analysisProgress.isRunning) {
      void refresh()
    }
  }, [analysisProgress, refresh])

  useEffect(() => {
    if (!analysisProgress) return
    const timer = setTimeout(() => void refresh(), 600)
    return () => clearTimeout(timer)
  }, [
    analysisProgress?.processing,
    analysisProgress?.pending,
    analysisProgress?.done,
    analysisProgress?.isRunning,
    refresh
  ])

  const handleAdd = async () => {
    const path = await window.api.library.pickDirectory()
    if (!path) return
    await window.api.library.add(path)
    await refresh()
  }

  const handleScan = async (id: string) => {
    setScanning(id)
    try {
      await window.api.library.scan(id)
      await refresh()
      toast('扫描完成', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setScanning(null)
    }
  }

  const handleStartAnalysis = async (id: string) => {
    const lib = libraries.find((item) => item.id === id)
    if (!lib || (lib.pendingCount ?? 0) === 0) {
      toast('当前图库没有待分析项', 'info')
      return
    }
    if (analysisProgress?.isRunning) {
      toast('已有分析任务进行中，请稍候', 'info')
      return
    }
    setAnalysisStarting(id)
    try {
      await window.api.analysis.start(id)
      toast(`已开始分析「${lib.name}」的 ${lib.pendingCount} 个待处理项`, 'success')
      await refresh()
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setAnalysisStarting(null)
    }
  }

  const handleRemove = async (id: string) => {
    const ok = await confirmAction({
      title: '删除图库',
      message: '确定删除此图库？图库中的索引数据将被清除。',
      danger: true,
      confirmLabel: '删除'
    })
    if (!ok) return
    await window.api.library.remove(id)
    await refresh()
  }

  const handleContextAction = async (action: string) => {
    if (!contextMenu) return
    const { library } = contextMenu
    setContextMenu(null)

    switch (action) {
      case 'openLocation':
        await window.api.library.openLocation(library.rootPath)
        break
      case 'scan':
        await handleScan(library.id)
        break
      case 'startAnalysis':
        await handleStartAnalysis(library.id)
        break
      case 'remove':
        await handleRemove(library.id)
        break
    }
  }

  const showScanProgress =
    scanning !== null && importProgress && importProgress.phase !== 'done'

  const showAnalysisProgress =
    analysisProgress &&
    analysisProgress.total > 0 &&
    (analysisProgress.isRunning || analysisProgress.processing > 0)

  const analysisBusy = analysisProgress?.isRunning ?? false

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">图库管理</h1>
          <p className="text-sm text-[var(--color-muted)] mt-1">扫描目录建立索引，确认后再手动开始 AI 分析</p>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="px-4 py-2 rounded-apple-sm bg-[var(--color-accent)] text-white text-sm font-medium hover:brightness-110"
        >
          + 添加图库
        </button>
      </div>

      {showScanProgress && importProgress && (
        <div className="mb-6">
          <ImportProgressBar progress={importProgress} />
        </div>
      )}

      {showAnalysisProgress && analysisProgress && (
        <div className="mb-6">
          <AnalysisProgressPanel progress={analysisProgress} />
        </div>
      )}

      <div className="grid gap-4">
        {libraries.length === 0 ? (
          <div className="p-12 text-center rounded-apple bg-[var(--color-card)] border border-[var(--color-border)]">
            <p className="text-[var(--color-muted)]">还没有图库，点击上方按钮添加目录</p>
          </div>
        ) : (
          libraries.map((lib) => {
            const pendingCount = lib.pendingCount ?? 0
            const processingCount = lib.processingCount ?? 0
            const canStartAnalysis = pendingCount > 0 && !analysisBusy && scanning !== lib.id

            return (
              <div
                key={lib.id}
                className="p-5 rounded-apple bg-[var(--color-card)] border border-[var(--color-border)] hover:shadow-md transition-shadow"
                onContextMenu={(e) => {
                  e.preventDefault()
                  setContextMenu({ library: lib, x: e.clientX, y: e.clientY })
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-lg">{lib.name}</h3>
                    <p className="text-xs text-[var(--color-muted)] mt-1 break-all">{lib.rootPath}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm">
                      <span>共 {lib.mediaCount ?? 0} 个</span>
                      <span>{formatFileSize(lib.totalSize ?? 0)}</span>
                      <span className="text-green-600">已分析 {lib.analyzedCount ?? 0}</span>
                      <span className="text-orange-500">待分析 {pendingCount}</span>
                      {processingCount > 0 && (
                        <span className="text-blue-500 animate-pulse">正在分析 {processingCount}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0 justify-end">
                    <button
                      type="button"
                      onClick={() => handleScan(lib.id)}
                      disabled={scanning === lib.id || analysisStarting === lib.id}
                      className="px-3 py-1.5 rounded-apple-sm bg-[var(--color-accent)] text-white text-xs disabled:opacity-50"
                    >
                      {scanning === lib.id ? '扫描中...' : '扫描目录'}
                    </button>
                    {pendingCount > 0 && (
                      <button
                        type="button"
                        onClick={() => handleStartAnalysis(lib.id)}
                        disabled={!canStartAnalysis || analysisStarting === lib.id}
                        className="px-3 py-1.5 rounded-apple-sm border border-[var(--color-accent)] text-[var(--color-accent)] text-xs disabled:opacity-50 hover:bg-[var(--color-accent)]/10"
                      >
                        {analysisStarting === lib.id
                          ? '启动中...'
                          : analysisBusy
                            ? '分析进行中...'
                            : `开始分析 (${pendingCount})`}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemove(lib.id)}
                      className="px-3 py-1.5 rounded-apple-sm border border-red-300 text-red-500 text-xs hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {contextMenu && (
        <ContextMenu
          title={contextMenu.library.name}
          x={contextMenu.x}
          y={contextMenu.y}
          items={LIBRARY_MENU}
          onSelect={handleContextAction}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
