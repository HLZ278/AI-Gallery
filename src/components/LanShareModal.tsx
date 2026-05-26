import { useCallback, useEffect, useState } from 'react'
import type { LanServerStatus, MediaItem } from '../../shared/types'
import { buildLanMediaViewUrl } from '../../shared/lanUrls'
import { fileNameFromPath } from '../utils/fileUrl'
import { LanAddressQr } from './LanAddressQr'

interface Props {
  item: MediaItem
  onClose: () => void
}

export function LanShareModal({ item, onClose }: Props) {
  const [status, setStatus] = useState<LanServerStatus | null>(null)

  useEffect(() => {
    window.api.lanServer.getStatus().then(setStatus).catch(() => setStatus(null))
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const buildUrl = useCallback(
    (address: string) => {
      if (!status) return ''
      return buildLanMediaViewUrl(address, status.port, status.token, item.id)
    },
    [status, item.id]
  )

  const fileName = fileNameFromPath(item.filePath)

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm p-6 rounded-apple bg-[var(--color-card)] border border-[var(--color-border)] shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">局域网分享</h2>
            <p className="text-xs text-[var(--color-muted)] mt-1 truncate" title={fileName}>
              {fileName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-8 h-8 rounded-full hover:bg-black/5 text-[var(--color-muted)]"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        {!status && <p className="text-sm text-[var(--color-muted)]">加载中…</p>}

        {status && !status.enabled && (
          <p className="text-sm text-orange-500">局域网传输已在设置中关闭，请开启后重试。</p>
        )}

        {status && status.enabled && !status.running && (
          <p className="text-sm text-orange-500">局域网服务未运行，请检查端口 {status.port} 或在设置中重新保存。</p>
        )}

        {status && status.enabled && status.running && (
          <LanAddressQr
            addresses={status.addresses}
            buildUrl={buildUrl}
            hint="手机扫码打开预览页，可查看并下载"
            emptyHint="未检测到局域网 IP，请确认电脑已连接 WiFi"
          />
        )}
      </div>
    </div>
  )
}
