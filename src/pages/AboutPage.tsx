import { useEffect, useState } from 'react'
import type { AppAboutInfo } from '../../shared/types'

export function AboutPage() {
  const [info, setInfo] = useState<AppAboutInfo | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    window.api.about
      .getInfo()
      .then(setInfo)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  if (error) {
    return (
      <div className="p-6 text-sm text-red-500">
        无法加载关于信息：{error}
      </div>
    )
  }

  if (!info) {
    return <div className="p-6 text-sm text-[var(--color-muted)]">加载中...</div>
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 max-w-2xl">
      <div className="flex items-center gap-4 mb-6">
        <img src={`${import.meta.env.BASE_URL}icon.png`} alt="" className="w-16 h-16 rounded-2xl shadow-sm" draggable={false} />
        <div>
          <h1 className="text-2xl font-semibold">{info.productName}</h1>
          <p className="text-sm text-[var(--color-muted)] mt-1">版本 {info.version}</p>
        </div>
      </div>

      <section className="mb-6 p-5 rounded-apple bg-[var(--color-card)] border border-[var(--color-border)] space-y-3">
        <h2 className="font-semibold">发行信息</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-[var(--color-muted)]">版本号</dt>
          <dd className="font-mono">{info.version}</dd>
          <dt className="text-[var(--color-muted)]">发行日期</dt>
          <dd>{info.releaseDate}</dd>
          <dt className="text-[var(--color-muted)]">联系人</dt>
          <dd>
            <a href={`mailto:${info.contactEmail}`} className="text-[var(--color-accent)] hover:underline">
              {info.contactEmail}
            </a>
          </dd>
          <dt className="text-[var(--color-muted)]">许可协议</dt>
          <dd>{info.licenseName}</dd>
        </dl>
        {info.releaseHighlights.length > 0 && (
          <div className="pt-2">
            <p className="text-sm font-medium mb-2">本版本亮点</p>
            <ul className="text-sm text-[var(--color-muted)] space-y-1 list-disc list-inside">
              {info.releaseHighlights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="mb-6 p-5 rounded-apple bg-[var(--color-card)] border border-[var(--color-border)] space-y-3">
        <h2 className="font-semibold">{info.licenseName}</h2>
        <pre className="text-xs leading-relaxed text-[var(--color-muted)] whitespace-pre-wrap font-sans max-h-72 overflow-y-auto p-3 rounded-apple-sm bg-black/5 dark:bg-white/5">
          {info.licenseText}
        </pre>
      </section>

      <p className="text-xs text-[var(--color-muted)]">{info.copyright}</p>
    </div>
  )
}
