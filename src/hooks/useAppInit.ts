import { useEffect } from 'react'
import { useAppStore } from '../store/appStore'

export function useAppInit(): void {
  const setConfig = useAppStore((s) => s.setConfig)
  const setLibraries = useAppStore((s) => s.setLibraries)
  const setAnalysisProgress = useAppStore((s) => s.setAnalysisProgress)
  const setImportProgress = useAppStore((s) => s.setImportProgress)
  const setTheme = useAppStore((s) => s.setTheme)

  useEffect(() => {
    window.api.config.get().then((config) => {
      setConfig(config)
      if (config.ui.theme === 'dark') setTheme('dark')
      else if (config.ui.theme === 'light') setTheme('light')
    })
    window.api.library.list().then(setLibraries)
    window.api.analysis.getProgress().then(setAnalysisProgress)

    const unsubAnalysis = window.api.analysis.onProgress(setAnalysisProgress)
    const unsubImport = window.api.import.onProgress(setImportProgress)

    return () => {
      unsubAnalysis()
      unsubImport()
    }
  }, [setConfig, setLibraries, setAnalysisProgress, setImportProgress, setTheme])
}
