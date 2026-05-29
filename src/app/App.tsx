import { Routes, Route, NavLink } from 'react-router-dom'
import { TitleBar } from '../components/TitleBar'
import { Sidebar } from '../components/Sidebar'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ToastContainer } from '../components/ToastContainer'
import { LibraryPage } from '../pages/LibraryPage'
import { ImportPage } from '../pages/ImportPage'
import { SearchPage } from '../pages/SearchPage'
import { ImageGenPage } from '../pages/ImageGenPage'
import { ImageEditPage } from '../pages/ImageEditPage'
import { SettingsPage } from '../pages/SettingsPage'
import { AboutPage } from '../pages/AboutPage'
import { useAppInit } from '../hooks/useAppInit'
import { useThemeSync } from '../hooks/useThemeSync'
import { useAppStore } from '../store/appStore'

export default function App() {
  const initError = useAppStore((s) => s.initError)

  useAppInit()
  useThemeSync()

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg)] text-[var(--color-text)]">
      <TitleBar />
      {initError && (
        <div className="px-4 py-2 text-xs text-red-600 bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-900">
          初始化失败：{initError}
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden flex flex-col">
          <Routes>
            <Route path="/" element={<SearchPage />} />
            <Route path="/image-gen" element={<ImageGenPage />} />
            <Route path="/image-edit" element={<ImageEditPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/about" element={<AboutPage />} />
          </Routes>
        </main>
      </div>
      <ToastContainer />
      <ConfirmDialog />
    </div>
  )
}

export { NavLink }
