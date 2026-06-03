import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AnalysisStatus, MediaItem, MediaType, SearchMode, SearchResult } from '../../shared/types'
import { MediaGrid } from '../components/MediaGrid'
import { MediaTimeline } from '../components/MediaTimeline'
import { MediaSelectionBar } from '../components/MediaSelectionBar'
import { DetailPanel } from '../components/DetailPanel'
import { MediaPreviewModal } from '../components/MediaPreviewModal'
import { MultiImagePreviewModal } from '../components/MultiImagePreviewModal'
import { MultiPreviewLauncher } from '../components/MultiPreviewLauncher'
import { MediaContextMenu, type MediaContextAction } from '../components/MediaContextMenu'
import { LanShareModal } from '../components/LanShareModal'
import { ShortcutHelpModal } from '../components/ShortcutHelpModal'
import { sliceImagesFrom, isMultiPreviewable } from '../components/preview/multiLayout'
import { useMediaSelection } from '../hooks/useMediaSelection'
import { useMediaGridShortcuts } from '../hooks/useMediaGridShortcuts'
import { useNavigateToImageEdit } from '../hooks/useNavigateToImageEdit'
import { useAppStore } from '../store/appStore'
import { toast } from '../store/toastStore'
import { confirmAction } from '../store/confirmStore'
import { sortMediaItems, type MediaSortField, type MediaSortOrder } from '../utils/mediaSort'

type ViewMode = 'grid' | 'timeline'
const PAGE_SIZE = 120

const mediaTypeOptions: { value: MediaType; label: string }[] = [
  { value: 'photo', label: '照片' },
  { value: 'video', label: '视频' },
  { value: 'gif', label: '动图' },
  { value: 'live_photo', label: '实况' },
  { value: 'panorama', label: '全景' },
  { value: 'burst', label: '连拍' }
]

export function SearchPage() {
  const libraries = useAppStore((s) => s.libraries)
  const setLibraries = useAppStore((s) => s.setLibraries)
  const config = useAppStore((s) => s.config)
  const analysisProgress = useAppStore((s) => s.analysisProgress)
  const prevProcessingIdsRef = useRef<Set<string>>(new Set())
  const searchInputRef = useRef<HTMLInputElement>(null)
  const filterAutoSearchRef = useRef(false)

  const [keyword, setKeyword] = useState('')
  const [searchMode, setSearchMode] = useState<SearchMode>('keyword')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<MediaType[]>([])
  const [libraryId, setLibraryId] = useState('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<SearchResult | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortField, setSortField] = useState<MediaSortField>('takenAt')
  const [sortOrder, setSortOrder] = useState<MediaSortOrder>('desc')
  const [previewState, setPreviewState] = useState<{ items: MediaItem[]; index: number } | null>(null)
  const [multiPreview, setMultiPreview] = useState<
    | { mode: 'window'; sourceItems: MediaItem[]; startItemId: string; windowSize: number }
    | { mode: 'selected'; items: MediaItem[] }
    | null
  >(null)
  const [contextMenu, setContextMenu] = useState<{ item: MediaItem; x: number; y: number } | null>(null)
  const [lanShareItem, setLanShareItem] = useState<MediaItem | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [enhanceBusy, setEnhanceBusy] = useState(false)

  const navigateToImageEdit = useNavigateToImageEdit()
  const embeddingEnabled = config?.embedding.enabled ?? false
  const columnMinWidth = config?.ui.gridColumnMinWidth ?? 160

  const preserveRankOrder = result?.searchMode === 'vector' || result?.searchMode === 'llm'
  const gridItems = useMemo(() => {
    const items = result?.items ?? []
    if (preserveRankOrder) return items
    return sortMediaItems(items, sortField, sortOrder)
  }, [result?.items, preserveRankOrder, sortField, sortOrder])

  const {
    selectedIds,
    focusId,
    primaryItem: selected,
    selectItem,
    selectAll,
    clearSelection,
    moveFocus,
    getSelectedItems
  } = useMediaSelection(gridItems)

  const buildQuery = useCallback(
    (pageNum: number) => ({
      keyword: keyword || undefined,
      mode: searchMode,
      dateFrom: dateFrom ? new Date(dateFrom).getTime() : undefined,
      dateTo: dateTo ? new Date(dateTo + 'T23:59:59').getTime() : undefined,
      mediaTypes: selectedTypes.length ? selectedTypes : undefined,
      libraryIds: libraryId ? [libraryId] : undefined,
      page: pageNum,
      pageSize: PAGE_SIZE
    }),
    [keyword, searchMode, dateFrom, dateTo, selectedTypes, libraryId]
  )

  const runQuery = useCallback(
    async (pageNum: number, append: boolean) => {
      setSearchError(null)
      const res = await window.api.search.query(buildQuery(pageNum))
      setResult((prev) => {
        if (!append || !prev || pageNum === 1) return res
        const seen = new Set(prev.items.map((item) => item.id))
        const mergedItems = [...prev.items]
        for (const item of res.items) {
          if (!seen.has(item.id)) mergedItems.push(item)
        }
        return {
          ...res,
          items: mergedItems,
          analysisMap: { ...prev.analysisMap, ...res.analysisMap },
          vectorScoreMap: { ...prev.vectorScoreMap, ...res.vectorScoreMap }
        }
      })
      setPage(pageNum)
      return res
    },
    [buildQuery]
  )

  const doSearch = useCallback(async () => {
    if ((searchMode === 'llm' || searchMode === 'vector') && !keyword.trim()) return
    if (searchMode === 'vector' && !embeddingEnabled) {
      toast('请先在设置中启用向量索引', 'error')
      return
    }
    setLoading(true)
    setHasSearched(true)
    try {
      await runQuery(1, false)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setSearchError(message)
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [runQuery, searchMode, keyword, embeddingEnabled])

  const loadMore = useCallback(async () => {
    if (!result || loadingMore || loading) return
    if (result.items.length >= result.total) return
    setLoadingMore(true)
    try {
      await runQuery(page + 1, true)
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setLoadingMore(false)
    }
  }, [result, loadingMore, loading, page, runQuery])

  const refreshResults = useCallback(async () => runQuery(page, false), [runQuery, page])

  const patchMediaStatus = useCallback((mediaId: string, status: AnalysisStatus) => {
    setResult((prev) => {
      if (!prev) return prev
      const items = prev.items.map((item) => (item.id === mediaId ? { ...item, analysisStatus: status } : item))
      if (items.every((item, index) => item === prev.items[index])) return prev
      return { ...prev, items }
    })
  }, [])

  const patchMediaStatusBatch = useCallback((mediaIds: string[], status: AnalysisStatus) => {
    const idSet = new Set(mediaIds)
    setResult((prev) => {
      if (!prev) return prev
      const items = prev.items.map((item) => (idSet.has(item.id) ? { ...item, analysisStatus: status } : item))
      return { ...prev, items }
    })
  }, [])

  const runEnhance = useCallback(
    async (mediaIds: string[]) => {
      if (mediaIds.length === 0) return
      setEnhanceBusy(true)
      try {
        patchMediaStatusBatch(mediaIds, 'pending')
        const count = await window.api.analysis.enhanceBatch(mediaIds)
        toast(`已提交 ${count} 项云端增强分析`, 'success')
      } catch (err) {
        toast(err instanceof Error ? err.message : String(err), 'error')
      } finally {
        setEnhanceBusy(false)
      }
    },
    [patchMediaStatusBatch]
  )

  useEffect(() => {
    if (!analysisProgress) return
    const processingIds = new Set(analysisProgress.currentFiles.map((file) => file.mediaId))
    setResult((prev) => {
      if (!prev) return prev
      let changed = false
      const items = prev.items.map((item) => {
        if (processingIds.has(item.id) && item.analysisStatus !== 'processing') {
          changed = true
          return { ...item, analysisStatus: 'processing' as const }
        }
        return item
      })
      return changed ? { ...prev, items } : prev
    })
    const finishedIds = [...prevProcessingIdsRef.current].filter((id) => !processingIds.has(id))
    prevProcessingIdsRef.current = processingIds
    if (finishedIds.length > 0) void refreshResults()
  }, [analysisProgress, refreshResults])

  useEffect(() => {
    void window.api.library.list().then(setLibraries)
  }, [setLibraries])

  useEffect(() => {
    if (libraryId && !libraries.some((lib) => lib.id === libraryId)) {
      setLibraryId('')
    }
  }, [libraries, libraryId])

  useEffect(() => {
    setLoading(true)
    window.api.search
      .query({ page: 1, pageSize: PAGE_SIZE })
      .then(setResult)
      .catch((err) => {
        setSearchError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!filterAutoSearchRef.current) {
      filterAutoSearchRef.current = true
      return
    }
    if (!hasSearched && !dateFrom && !dateTo && !libraryId && selectedTypes.length === 0) return
    const timer = setTimeout(() => {
      void doSearch()
    }, 300)
    return () => clearTimeout(timer)
  }, [dateFrom, dateTo, libraryId, selectedTypes, hasSearched, doSearch])

  const resetFilters = () => {
    setDateFrom('')
    setDateTo('')
    setLibraryId('')
    setSelectedTypes([])
  }

  const searchByTag = (tag: string) => {
    setKeyword(tag)
    setSearchMode('keyword')
    setHasSearched(true)
    void window.api.search.query({
      keyword: tag,
      mode: 'keyword',
      page: 1,
      pageSize: PAGE_SIZE
    }).then(setResult)
  }

  const toggleType = (type: MediaType) => {
    setSelectedTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]))
  }

  const handleMediaRemoved = useCallback(
    async (mediaId: string) => {
      if (selected?.id === mediaId) clearSelection()
      if (previewState?.items.some((i) => i.id === mediaId)) setPreviewState(null)
      if (multiPreview?.mode === 'window' && multiPreview.startItemId === mediaId) setMultiPreview(null)
      if (multiPreview?.mode === 'selected' && multiPreview.items.some((i) => i.id === mediaId)) setMultiPreview(null)
      setContextMenu(null)
      return refreshResults()
    },
    [selected, previewState, multiPreview, refreshResults, clearSelection]
  )

  const copyMediaItems = useCallback(async (items: MediaItem[]) => {
    if (items.length === 0) return
    await window.api.media.copyItems(items.map((i) => ({ filePath: i.filePath, mediaType: i.mediaType })))
  }, [])

  const openPreview = useCallback(
    (item: MediaItem) => {
      const items = result?.items ?? [item]
      const index = items.findIndex((i) => i.id === item.id)
      setPreviewState({ items, index: Math.max(0, index) })
    },
    [result?.items]
  )

  useMediaGridShortcuts({
    enabled: !previewState && !multiPreview && !contextMenu && !lanShareItem && !showShortcuts,
    getSelectedItems,
    primaryItem: selected,
    selectAll,
    clearSelection,
    moveFocus,
    onPreview: openPreview,
    onCloseDetail: () => clearSelection()
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (previewState || multiPreview || contextMenu || lanShareItem || showShortcuts) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        setShowShortcuts(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [previewState, multiPreview, contextMenu, lanShareItem, showShortcuts])

  useEffect(() => {
    if (!focusId) return
    document.querySelector(`[data-media-id="${focusId}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [focusId])

  const handleContextAction = async (action: MediaContextAction) => {
    if (!contextMenu) return
    const { item } = contextMenu
    setContextMenu(null)

    switch (action) {
      case 'copy': {
        const targets = selectedIds.has(item.id) && selectedIds.size > 1 ? getSelectedItems() : [item]
        try {
          await copyMediaItems(targets)
          toast(targets.length > 1 ? `已复制 ${targets.length} 个文件` : '已复制文件，可在资源管理器中粘贴', 'success')
        } catch (err) {
          toast(err instanceof Error ? err.message : String(err), 'error')
        }
        break
      }
      case 'copyPath':
        await window.api.media.copyPath(item.filePath)
        break
      case 'lanShare':
        setLanShareItem(item)
        break
      case 'sendToEdit': {
        const targets = selectedIds.has(item.id) && selectedIds.size > 1 ? getSelectedItems() : [item]
        await navigateToImageEdit(targets)
        break
      }
      case 'showInFolder':
        await window.api.media.showInFolder(item.filePath)
        break
      case 'enhanceCloud': {
        const targets = selectedIds.has(item.id) && selectedIds.size > 1 ? getSelectedItems() : [item]
        await runEnhance(targets.map((t) => t.id))
        break
      }
      case 'removeFromDb': {
        const targets =
          selectedIds.has(item.id) && selectedIds.size > 1 ? getSelectedItems() : [item]
        const ok = await confirmAction({
          message:
            targets.length > 1
              ? `从数据库移除选中的 ${targets.length} 项？本地文件保留。`
              : '从数据库移除此项？本地文件保留，重新扫描图库可再次导入并分析。',
          danger: true,
          confirmLabel: '移除'
        })
        if (!ok) return
        try {
          for (const t of targets) await window.api.media.removeFromDb(t.id)
          for (const t of targets) await handleMediaRemoved(t.id)
          toast(targets.length > 1 ? `已从数据库移除 ${targets.length} 项` : '已从数据库移除', 'success')
        } catch (err) {
          toast(err instanceof Error ? err.message : String(err), 'error')
        }
        break
      }
      case 'deleteFromDisk': {
        const targets =
          selectedIds.has(item.id) && selectedIds.size > 1 ? getSelectedItems() : [item]
        const ok = await confirmAction({
          message:
            targets.length > 1
              ? `确定从本地删除选中的 ${targets.length} 个文件？此操作不可恢复。`
              : '确定从本地删除此文件？此操作不可恢复。',
          danger: true,
          confirmLabel: '删除'
        })
        if (!ok) return
        try {
          for (const t of targets) await window.api.media.deleteFromDisk(t.id)
          for (const t of targets) await handleMediaRemoved(t.id)
          toast(targets.length > 1 ? `已删除 ${targets.length} 个本地文件` : '已删除本地文件', 'success')
        } catch (err) {
          toast(err instanceof Error ? err.message : String(err), 'error')
        }
        break
      }
    }
  }

  const openMultiPreviewWindow = (count: number) => {
    if (!selected || !result?.items) return
    const slice = sliceImagesFrom(result.items, selected.id, count)
    if (slice.length === 0) return
    setMultiPreview({ mode: 'window', sourceItems: result.items, startItemId: selected.id, windowSize: count })
  }

  const openMultiPreviewSelected = () => {
    const items = getSelectedItems().filter((i) => isMultiPreviewable(i.mediaType)).slice(0, 6)
    if (items.length < 2) return
    setMultiPreview({ mode: 'selected', items })
  }

  const selectedItems = getSelectedItems()
  const analysis = selected ? result?.analysisMap[selected.id] ?? null : null
  const hasMore = result != null && result.items.length < result.total

  const emptyMessage =
    libraries.length === 0
      ? '暂无图库，请先在「图库」页添加目录'
      : hasSearched && keyword.trim()
        ? '未找到匹配结果，可尝试更换关键词、搜索模式或筛选条件'
        : hasSearched
          ? '当前筛选条件下没有图片'
          : '暂无图片，请先添加图库或导入图片'

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-4 glass border-b border-[var(--color-border)] space-y-3">
        <div className="flex gap-2 mb-1 flex-wrap">
          <button
            type="button"
            onClick={() => setSearchMode('keyword')}
            className={`px-3 py-1 rounded-full text-xs border transition-colors ${
              searchMode === 'keyword' ? 'bg-[var(--color-accent)] text-white border-transparent' : 'border-[var(--color-border)]'
            }`}
          >
            关键词搜索
          </button>
          <button
            type="button"
            onClick={() => setSearchMode('llm')}
            className={`px-3 py-1 rounded-full text-xs border transition-colors ${
              searchMode === 'llm' ? 'bg-[var(--color-accent)] text-white border-transparent' : 'border-[var(--color-border)]'
            }`}
          >
            AI 智能搜索
          </button>
          <button
            type="button"
            onClick={() => embeddingEnabled && setSearchMode('vector')}
            disabled={!embeddingEnabled}
            title={embeddingEnabled ? undefined : '请先在设置中启用向量索引'}
            className={`px-3 py-1 rounded-full text-xs border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              searchMode === 'vector' ? 'bg-[var(--color-accent)] text-white border-transparent' : 'border-[var(--color-border)]'
            }`}
          >
            向量语义
          </button>
          <button
            type="button"
            onClick={() => setShowShortcuts(true)}
            className="ml-auto px-3 py-1 rounded-full text-xs border border-[var(--color-border)] hover:bg-black/5"
          >
            快捷键 ?
          </button>
        </div>
        <div className="flex gap-2">
          <input
            ref={searchInputRef}
            type="search"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void doSearch()}
            placeholder={
              searchMode === 'llm'
                ? '用自然语言描述，AI 将从图库详情中语义匹配...'
                : searchMode === 'vector'
                  ? '模糊描述即可，如：校服少女、湖边情侣、梗图...'
                  : '精确关键词，如：铁链、JK、羽毛球赛、蔡徐坤...'
            }
            className="flex-1 px-4 py-2.5 rounded-apple bg-[var(--color-card)] border border-[var(--color-border)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 text-sm"
          />
          <button
            type="button"
            onClick={() => void doSearch()}
            disabled={loading || ((searchMode === 'llm' || searchMode === 'vector') && !keyword.trim())}
            className="px-5 py-2.5 rounded-apple-sm bg-[var(--color-accent)] text-white text-sm font-medium hover:brightness-110 disabled:opacity-50"
          >
            {loading ? (searchMode === 'llm' ? 'AI 匹配中...' : searchMode === 'vector' ? '向量检索中...' : '搜索中...') : '搜索'}
          </button>
        </div>
        {searchMode === 'vector' && !embeddingEnabled && (
          <p className="text-[10px] text-orange-500">向量索引已关闭，请在设置中启用并建立索引</p>
        )}
        {searchMode === 'llm' && (
          <p className="text-[10px] text-[var(--color-muted)]">
            AI 搜索仅传入图库中已分析图片的文字详情，不传图片本身，由大模型进行语义匹配，慎用，消耗 Token 较多
          </p>
        )}
        {searchMode === 'vector' && embeddingEnabled && (
          <p className="text-[10px] text-[var(--color-muted)]">
            向量语义搜索：将查询与图片详情转为向量，按相似度匹配，无需精确关键词（需先在设置中建立向量索引）
          </p>
        )}
        {searchMode === 'keyword' && (
          <p className="text-[10px] text-[var(--color-muted)]">
            关键词会匹配：描述、场景、故事、位置、人物、物体、标签、IP、氛围、颜色、图中文字、GPS、文件名
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <div className="flex items-center gap-1 mr-1">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-apple-sm text-xs border transition-colors ${
                viewMode === 'grid' ? 'bg-[var(--color-accent)] text-white border-transparent' : 'border-[var(--color-border)] hover:bg-black/5'
              }`}
            >
              网格
            </button>
            <button
              type="button"
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1.5 rounded-apple-sm text-xs border transition-colors ${
                viewMode === 'timeline' ? 'bg-[var(--color-accent)] text-white border-transparent' : 'border-[var(--color-border)] hover:bg-black/5'
              }`}
            >
              时间轴
            </button>
          </div>
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as MediaSortField)}
            disabled={preserveRankOrder}
            className="px-3 py-1.5 rounded-apple-sm bg-[var(--color-card)] border border-[var(--color-border)] text-xs disabled:opacity-50"
          >
            <option value="takenAt">按拍摄时间</option>
            <option value="importedAt">按导入时间</option>
          </select>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as MediaSortOrder)}
            disabled={preserveRankOrder}
            className="px-3 py-1.5 rounded-apple-sm bg-[var(--color-card)] border border-[var(--color-border)] text-xs disabled:opacity-50"
          >
            <option value="desc">新 → 旧</option>
            <option value="asc">旧 → 新</option>
          </select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-3 py-1.5 rounded-apple-sm bg-[var(--color-card)] border border-[var(--color-border)] text-xs" />
          <span className="text-[var(--color-muted)]">至</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-3 py-1.5 rounded-apple-sm bg-[var(--color-card)] border border-[var(--color-border)] text-xs" />
          <select value={libraryId} onChange={(e) => setLibraryId(e.target.value)} className="px-3 py-1.5 rounded-apple-sm bg-[var(--color-card)] border border-[var(--color-border)] text-xs">
            <option value="">全部图库</option>
            {libraries.map((lib) => (
              <option key={lib.id} value={lib.id}>{lib.name}</option>
            ))}
          </select>
          {mediaTypeOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleType(opt.value)}
              className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                selectedTypes.includes(opt.value) ? 'bg-[var(--color-accent)] text-white border-transparent' : 'border-[var(--color-border)] hover:bg-black/5'
              }`}
            >
              {opt.label}
            </button>
          ))}
          <button type="button" onClick={resetFilters} className="px-3 py-1 rounded-full text-xs border border-[var(--color-border)] hover:bg-black/5">
            重置筛选
          </button>
        </div>
        {searchError && <p className="text-xs text-red-500">{searchError}</p>}
        {result && (
          <div className="text-xs text-[var(--color-muted)] space-y-1">
            <p>
              共 {result.total} 个结果{result.items.length < result.total ? `，已加载 ${result.items.length} 个` : ''}
              {result.searchMode === 'llm' && ' · AI 智能搜索'}
              {result.searchMode === 'vector' && ' · 向量语义搜索（按相似度排序）'}
            </p>
            {result.llmReason && (
              <p className={result.total === 0 ? 'text-orange-500' : 'text-[var(--color-accent)]'}>{result.llmReason}</p>
            )}
          </div>
        )}
        {preserveRankOrder && <p className="text-[10px] text-[var(--color-muted)]">向量/AI 搜索结果按相关度排序，时间排序已禁用</p>}
      </div>
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
          <MultiPreviewLauncher
            selected={selected}
            selectedItems={selectedItems}
            onLaunchSelected={openMultiPreviewSelected}
            onLaunchWindow={openMultiPreviewWindow}
          />
          <MediaSelectionBar
            count={selectedIds.size}
            enhanceBusy={enhanceBusy}
            onEnhanceBatch={() => void runEnhance(getSelectedItems().map((i) => i.id))}
          />
          {viewMode === 'timeline' ? (
            <MediaTimeline
              items={gridItems}
              sortField={sortField}
              selectedIds={selectedIds}
              focusId={focusId}
              onSelect={(item, e) => selectItem(item, { shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey })}
              onDoubleClick={openPreview}
              onContextMenu={(item, e) => setContextMenu({ item, x: e.clientX, y: e.clientY })}
              scoreMap={result?.vectorScoreMap}
            />
          ) : (
            <MediaGrid
              items={gridItems}
              columnMinWidth={columnMinWidth}
              emptyMessage={emptyMessage}
              selectedIds={selectedIds}
              focusId={focusId}
              onSelect={(item, e) => selectItem(item, { shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey })}
              onDoubleClick={openPreview}
              onContextMenu={(item, e) => setContextMenu({ item, x: e.clientX, y: e.clientY })}
              scoreMap={result?.vectorScoreMap}
            />
          )}
          {hasMore && (
            <div className="shrink-0 flex justify-center py-3 border-t border-[var(--color-border)]">
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="px-5 py-2 rounded-apple-sm border border-[var(--color-border)] text-sm hover:bg-black/5 disabled:opacity-50"
              >
                {loadingMore ? '加载中...' : `加载更多（${result!.items.length}/${result!.total}）`}
              </button>
            </div>
          )}
        </div>
        {selected && (
          <DetailPanel
            item={selected}
            analysis={analysis}
            vectorScore={result?.vectorScoreMap?.[selected.id]}
            onClose={() => clearSelection()}
            onSearchTag={searchByTag}
            onSendToEdit={() => void navigateToImageEdit([selected])}
            onRetry={async () => {
              const mediaId = selected.id
              patchMediaStatus(mediaId, 'pending')
              await window.api.media.retryAnalysis(mediaId)
            }}
            onEnhance={async () => {
              const mediaId = selected.id
              try {
                patchMediaStatus(mediaId, 'pending')
                await window.api.media.enhanceAnalysis(mediaId)
              } catch (err) {
                toast(err instanceof Error ? err.message : String(err), 'error')
                throw err
              }
            }}
            onCancel={async () => {
              const mediaId = selected.id
              await window.api.media.cancelAnalysis(mediaId)
              const hasAnalysis = analysis != null
              patchMediaStatus(mediaId, hasAnalysis ? 'done' : 'pending')
              toast('已停止分析', 'info')
            }}
          />
        )}
      </div>

      {previewState && (
        <MediaPreviewModal items={previewState.items} initialIndex={previewState.index} onClose={() => setPreviewState(null)} />
      )}
      {multiPreview?.mode === 'window' && (
        <MultiImagePreviewModal mode="window" sourceItems={multiPreview.sourceItems} startItemId={multiPreview.startItemId} windowSize={multiPreview.windowSize} onClose={() => setMultiPreview(null)} />
      )}
      {multiPreview?.mode === 'selected' && (
        <MultiImagePreviewModal mode="selected" items={multiPreview.items} onClose={() => setMultiPreview(null)} />
      )}
      {contextMenu && (
        <MediaContextMenu item={contextMenu.item} x={contextMenu.x} y={contextMenu.y} onAction={handleContextAction} onClose={() => setContextMenu(null)} />
      )}
      {lanShareItem && <LanShareModal item={lanShareItem} onClose={() => setLanShareItem(null)} />}
      <ShortcutHelpModal open={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </div>
  )
}
