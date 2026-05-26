import { APP_DISPLAY_NAME } from '../../shared/appMeta'

export function TitleBar() {
  return (
    <header
      className="h-11 flex items-center justify-between px-4 glass border-b border-[var(--color-border)] select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          type="button"
          onClick={() => window.api.window.close()}
          className="w-3 h-3 rounded-full bg-[#FF5F57] hover:brightness-90"
          aria-label="关闭"
        />
        <button
          type="button"
          onClick={() => window.api.window.minimize()}
          className="w-3 h-3 rounded-full bg-[#FFBD2E] hover:brightness-90"
          aria-label="最小化"
        />
        <button
          type="button"
          onClick={() => window.api.window.maximize()}
          className="w-3 h-3 rounded-full bg-[#28C840] hover:brightness-90"
          aria-label="最大化"
        />
      </div>
      <div className="flex items-center gap-2">
        <img src={`${import.meta.env.BASE_URL}icon.png`} alt="" className="w-5 h-5 rounded-md" draggable={false} />
        <span className="text-sm font-medium opacity-80">{APP_DISPLAY_NAME}</span>
      </div>
      <div className="w-16" />
    </header>
  )
}
