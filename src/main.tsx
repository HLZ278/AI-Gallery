import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { APP_DISPLAY_NAME } from '../shared/appMeta'
import App from './app/App'
import './styles/globals.css'
import { useAppStore } from './store/appStore'

function ThemeSync(): null {
  const theme = useAppStore((s) => s.theme)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])
  return null
}

document.title = APP_DISPLAY_NAME

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <ThemeSync />
      <App />
    </HashRouter>
  </StrictMode>
)
