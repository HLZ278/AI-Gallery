import { useEffect } from 'react'
import { useAppStore } from '../store/appStore'

export function useAppInit(): void {
  const setConfig = useAppStore((s) => s.setConfig)
  const setLibraries = useAppStore((s) => s.setLibraries)
  const setAnalysisProgress = useAppStore((s) => s.setAnalysisProgress)
  const setImportProgress = useAppStore((s) => s.setImportProgress)
  const setTheme = useAppStore((s) => s.setTheme)
  const setInitError = useAppStore((s) => s.setInitError)

  useEffect(() => {
    void (async () => {
      try {
        const config = await window.api.config.get()
        setConfig(config)
        if (config.ui.theme === 'dark') setTheme('dark')
        else if (config.ui.theme === 'light') setTheme('light')
        setInitError(null)
      } catch (err) {
        setInitError(err instanceof Error ? err.message : String(err))
      }

      try {
        setLibraries(await window.api.library.list())
      } catch (err) {
        setInitError(err instanceof Error ? err.message : String(err))
      }

      try {
        setAnalysisProgress(await window.api.analysis.getProgress())
      } catch {
        /* optional */
      }
    })()

    const unsubAnalysis = window.api.analysis.onProgress(setAnalysisProgress)
    const unsubImport = window.api.import.onProgress(setImportProgress)

    return () => {
      unsubAnalysis()
      unsubImport()
    }
  }, [setConfig, setLibraries, setAnalysisProgress, setImportProgress, setTheme, setInitError])
}
