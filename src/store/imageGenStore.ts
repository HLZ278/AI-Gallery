import { create } from 'zustand'
import type { ImageGenSession, ImageGenStoredMessage } from '../../shared/types'

const WELCOME: ImageGenStoredMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    '描述你想生成的画面，我会调用千问文生图模型为你创作。生成后请预览并选择「接受并保存」或「拒绝」。未指定图库时将保存到第一个图库。'
}

interface ImageGenState {
  hydrated: boolean
  libraryId: string
  size: string
  messages: ImageGenStoredMessage[]
  setHydrated: (hydrated: boolean) => void
  setLibraryId: (libraryId: string) => void
  setSize: (size: string) => void
  setMessages: (
    updater: ImageGenStoredMessage[] | ((prev: ImageGenStoredMessage[]) => ImageGenStoredMessage[])
  ) => void
  hydrateFromSession: (session: ImageGenSession) => void
  resetToWelcome: () => void
}

export const useImageGenStore = create<ImageGenState>((set) => ({
  hydrated: false,
  libraryId: '',
  size: '',
  messages: [WELCOME],
  setHydrated: (hydrated) => set({ hydrated }),
  setLibraryId: (libraryId) => set({ libraryId }),
  setSize: (size) => set({ size }),
  setMessages: (updater) =>
    set((state) => ({
      messages: typeof updater === 'function' ? updater(state.messages) : updater
    })),
  hydrateFromSession: (session) =>
    set({
      libraryId: session.libraryId,
      size: session.size,
      messages: session.messages.length > 0 ? session.messages : [WELCOME],
      hydrated: true
    }),
  resetToWelcome: () =>
    set({
      libraryId: '',
      size: '',
      messages: [WELCOME]
    })
}))

export function buildImageGenSession(state: Pick<ImageGenState, 'libraryId' | 'size' | 'messages'>): ImageGenSession {
  return {
    libraryId: state.libraryId,
    size: state.size,
    messages: state.messages
  }
}
