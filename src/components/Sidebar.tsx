import { NavLink } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import { AnalysisProgressPanel } from './AnalysisProgressPanel'

const navItems = [
  { to: '/', label: '搜索', icon: '🔍' },
  { to: '/image-gen', label: '文生图', icon: '✨' },
  { to: '/image-edit', label: 'AI 编辑', icon: '🎨' },
  { to: '/library', label: '图库', icon: '📁' },
  { to: '/import', label: '导入', icon: '📥' },
  { to: '/settings', label: '设置', icon: '⚙️' },
  { to: '/about', label: '关于', icon: 'ℹ️' }
]

export function Sidebar() {
  const analysisProgress = useAppStore((s) => s.analysisProgress)
  const showProgress = analysisProgress && analysisProgress.total > 0

  return (
    <aside className="w-52 glass border-r border-[var(--color-border)] flex flex-col py-4">
      <nav className="flex flex-col gap-1 px-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-apple-sm text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-[var(--color-accent)] text-white shadow-sm'
                  : 'text-[var(--color-text)] opacity-80 hover:bg-black/5 dark:hover:bg-white/10'
              }`
            }
          >
            <span>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
      {showProgress && (
        <div className="mt-auto mx-3">
          <AnalysisProgressPanel progress={analysisProgress} compact />
        </div>
      )}
    </aside>
  )
}
