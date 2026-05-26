import { create } from 'zustand'

export type ToastKind = 'info' | 'success' | 'error'

interface ToastItem {
  id: string
  message: string
  kind: ToastKind
}

interface ToastState {
  items: ToastItem[]
  show: (message: string, kind?: ToastKind) => void
  dismiss: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
  items: [],
  show: (message, kind = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    set((state) => ({ items: [...state.items, { id, message, kind }] }))
    setTimeout(() => {
      set((state) => ({ items: state.items.filter((item) => item.id !== id) }))
    }, 4000)
  },
  dismiss: (id) => set((state) => ({ items: state.items.filter((item) => item.id !== id) }))
}))

export function toast(message: string, kind: ToastKind = 'info'): void {
  useToastStore.getState().show(message, kind)
}
