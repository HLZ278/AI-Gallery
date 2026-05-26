import { useCallback, useEffect, useState } from 'react'
import type { LanServerStatus } from '../../shared/types'
import { buildLanPageUrl } from '../../shared/lanUrls'
import { LanAddressQr } from './LanAddressQr'

export function LanTransferPanel() {
  const [status, setStatus] = useState<LanServerStatus | null>(null)

  const refresh = useCallback(async () => {
    try {
      setStatus(await window.api.lanServer.getStatus())
    } catch {
      setStatus(null)
    }
  }, [])

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, 5000)
    const unsub = window.api.lanServer.onUploadComplete(() => refresh())
    return () => {
      clearInterval(timer)
      unsub()
    }
  }, [refresh])

  const buildPageUrl = useCallback(
    (address: string) => {
      if (!status) return ''
      return buildLanPageUrl(address, status.port, status.token)
    },
    [status]
  )

  if (!status) {
    return (
      <div className="p-5 rounded-apple bg-[var(--color-card)] border border-[var(--color-border)]">
        <p className="text-sm text-[var(--color-muted)]">局域网服务状态加载中…</p>
      </div>
    )
  }

  if (!status.enabled) {
    return (
      <div className="p-5 rounded-apple bg-[var(--color-card)] border border-[var(--color-border)] space-y-2">
        <h2 className="font-semibold text-sm">局域网传输</h2>
        <p className="text-xs text-[var(--color-muted)]">
          已在设置中关闭。开启后，同一 WiFi 下的手机可扫码访问网页，上传或下载图库照片。
        </p>
      </div>
    )
  }

  return (
    <div className="p-5 rounded-apple bg-[var(--color-card)] border border-[var(--color-border)] space-y-4">
      <div>
        <h2 className="font-semibold text-sm">局域网传输</h2>
        <p className="text-xs text-[var(--color-muted)] mt-1">
          手机与电脑连接同一 WiFi，选择局域网 IP 后扫码打开上传/下载页面
        </p>
      </div>

      {!status.running && (
        <p className="text-xs text-orange-500">服务未启动，请检查端口 {status.port} 是否被占用，或在设置中重新保存配置</p>
      )}

      {status.running && (
        <LanAddressQr
          addresses={status.addresses}
          buildUrl={buildPageUrl}
          hint="扫码打开手机端上传/下载页"
          emptyHint="未检测到局域网 IP，请确认已连接 WiFi"
        />
      )}

      <p className="text-[10px] text-[var(--color-muted)]">端口 {status.port}</p>
    </div>
  )
}
