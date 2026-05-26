import { useCallback, useState } from 'react'
import type { Library } from '../../shared/types'
import { ContextMenu, type ContextMenuItem } from '../components/ContextMenu'
import { formatFileSize } from '../utils/formatMedia'
import { useAppStore } from '../store/appStore'

const LIBRARY_MENU: ContextMenuItem[] = [
  { id: 'openLocation', label: '打开所在位置' },
  { id: 'scan', label: '扫描目录' },
  { id: 'remove', label: '删除图库', danger: true }
]

export function LibraryPage() {
  const libraries = useAppStore((s) => s.libraries)
  const setLibraries = useAppStore((s) => s.setLibraries)
  const [scanning, setScanning] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ library: Library; x: number; y: number } | null>(null)

  const refresh = useCallback(async () => {
    setLibraries(await window.api.library.list())
  }, [setLibraries])

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
    } finally {
      setScanning(null)
    }
  }

  const handleRemove = async (id: string) => {
    if (!confirm('确定删除此图库？图库中的索引数据将被清除。')) return
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
      case 'remove':
        await handleRemove(library.id)
        break
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">图库管理</h1>
          <p className="text-sm text-[var(--color-muted)] mt-1">指定目录建立图库，扫描并索引所有图片</p>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="px-4 py-2 rounded-apple-sm bg-[var(--color-accent)] text-white text-sm font-medium hover:brightness-110"
        >
          + 添加图库
        </button>
      </div>

      <div className="grid gap-4">
        {libraries.length === 0 ? (
          <div className="p-12 text-center rounded-apple bg-[var(--color-card)] border border-[var(--color-border)]">
            <p className="text-[var(--color-muted)]">还没有图库，点击上方按钮添加目录</p>
          </div>
        ) : (
          libraries.map((lib) => (
            <div
              key={lib.id}
              className="p-5 rounded-apple bg-[var(--color-card)] border border-[var(--color-border)] hover:shadow-md transition-shadow"
              onContextMenu={(e) => {
                e.preventDefault()
                setContextMenu({ library: lib, x: e.clientX, y: e.clientY })
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{lib.name}</h3>
                  <p className="text-xs text-[var(--color-muted)] mt-1 break-all">{lib.rootPath}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm">
                    <span>共 {lib.mediaCount ?? 0} 个</span>
                    <span>{formatFileSize(lib.totalSize ?? 0)}</span>
                    <span className="text-green-600">已分析 {lib.analyzedCount ?? 0}</span>
                    <span className="text-orange-500">待分析 {lib.pendingCount ?? 0}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleScan(lib.id)}
                    disabled={scanning === lib.id}
                    className="px-3 py-1.5 rounded-apple-sm bg-[var(--color-accent)] text-white text-xs disabled:opacity-50"
                  >
                    {scanning === lib.id ? '扫描中...' : '扫描目录'}
                  </button>
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
          ))
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
