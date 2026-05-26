declare global {
  interface Window {
    api: import('../../shared/types').IpcApi & {
      window: {
        minimize: () => void
        maximize: () => void
        close: () => void
      }
    }
  }
}

export {}
