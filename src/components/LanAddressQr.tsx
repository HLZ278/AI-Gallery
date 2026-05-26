import { useCallback, useEffect, useState } from 'react'
import { generateLanQrDataUrl } from '../utils/lanQr'

interface Props {
  addresses: string[]
  buildUrl: (address: string) => string
  hint?: string
  emptyHint?: string
}

export function LanAddressQr({ addresses, buildUrl, hint, emptyHint }: Props) {
  const [selected, setSelected] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!selected) {
      setQrDataUrl(null)
      return
    }
    let cancelled = false
    generateLanQrDataUrl(buildUrl(selected))
      .then((url) => {
        if (!cancelled) setQrDataUrl(url)
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [selected, buildUrl])

  const activeUrl = selected ? buildUrl(selected) : ''

  const copyUrl = useCallback(async () => {
    if (!activeUrl) return
    await navigator.clipboard.writeText(activeUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [activeUrl])

  if (addresses.length === 0) {
    return <p className="text-xs text-orange-500">{emptyHint ?? '未检测到局域网 IP'}</p>
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-[var(--color-muted)] mb-1.5">选择局域网地址</label>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full px-3 py-2 rounded-apple-sm bg-[var(--color-bg)] border border-[var(--color-border)] text-sm"
        >
          <option value="">请选择 IP…</option>
          {addresses.map((addr) => (
            <option key={addr} value={addr}>
              {addr}
            </option>
          ))}
        </select>
      </div>

      {selected && qrDataUrl && (
        <div className="flex flex-col items-center gap-3 p-4 rounded-apple-sm bg-[var(--color-bg)] border border-[var(--color-border)]">
          <img src={qrDataUrl} alt="局域网二维码" className="w-[220px] h-[220px] rounded-lg" />
          {hint && <p className="text-xs text-[var(--color-muted)] text-center">{hint}</p>}
          <code className="text-[10px] text-[var(--color-muted)] break-all text-center w-full">{activeUrl}</code>
          <button
            type="button"
            onClick={copyUrl}
            className="px-4 py-2 rounded-apple-sm border border-[var(--color-accent)] text-[var(--color-accent)] text-xs font-medium"
          >
            {copied ? '已复制链接' : '复制链接'}
          </button>
        </div>
      )}

      {selected && !qrDataUrl && <p className="text-xs text-[var(--color-muted)]">二维码生成中…</p>}
    </div>
  )
}
