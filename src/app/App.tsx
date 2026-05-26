import { Routes, Route, NavLink } from 'react-router-dom'
import { TitleBar } from '../components/TitleBar'
import { Sidebar } from '../components/Sidebar'
import { LibraryPage } from '../pages/LibraryPage'
import { ImportPage } from '../pages/ImportPage'
import { SearchPage } from '../pages/SearchPage'
import { ImageGenPage } from '../pages/ImageGenPage'
import { ImageEditPage } from '../pages/ImageEditPage'
import { SettingsPage } from '../pages/SettingsPage'
import { useAppInit } from '../hooks/useAppInit'

export default function App() {
  useAppInit()

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg)] text-[var(--color-text)]">
      <TitleBar />
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
          </Routes>
        </main>
      </div>
    </div>
  )
}

export { NavLink }
