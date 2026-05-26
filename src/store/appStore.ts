import { create } from 'zustand'
import type { AppConfig, Library, AnalysisProgress, ImportProgress, MediaItem } from '../../shared/types'

interface AppState {
  config: AppConfig | null
  libraries: Library[]
  selectedLibraryId: string | null
  analysisProgress: AnalysisProgress | null
  importProgress: ImportProgress | null
  theme: 'light' | 'dark'
  selectedMedia: MediaItem | null
  setConfig: (config: AppConfig | null) => void
  setLibraries: (libraries: Library[]) => void
  setSelectedLibraryId: (id: string | null) => void
  setAnalysisProgress: (p: AnalysisProgress | null) => void
  setImportProgress: (p: ImportProgress | null) => void
  setTheme: (theme: 'light' | 'dark') => void
  setSelectedMedia: (media: MediaItem | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  config: null,
  libraries: [],
  selectedLibraryId: null,
  analysisProgress: null,
  importProgress: null,
  theme: 'light',
  selectedMedia: null,
  setConfig: (config) => set({ config }),
  setLibraries: (libraries) => set({ libraries }),
  setSelectedLibraryId: (id) => set({ selectedLibraryId: id }),
  setAnalysisProgress: (p) => set({ analysisProgress: p }),
  setImportProgress: (p) => set({ importProgress: p }),
  setTheme: (theme) => set({ theme }),
  setSelectedMedia: (media) => set({ selectedMedia: media })
}))
