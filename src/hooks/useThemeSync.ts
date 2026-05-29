import { useEffect } from 'react'
import { useAppStore } from '../store/appStore'
import { resolveTheme, subscribeSystemTheme } from '../utils/theme'

export function useThemeSync(): void {
  const preference = useAppStore((s) => s.config?.ui.theme ?? 'light')
  const setTheme = useAppStore((s) => s.setTheme)

  useEffect(() => {
    setTheme(resolveTheme(preference))
    if (preference !== 'system') return
    return subscribeSystemTheme(setTheme)
  }, [preference, setTheme])
}
