import { create } from 'zustand'
import type { ImageEditSession, ImageEditStoredMessage } from '../../shared/types'

const WELCOME: ImageEditStoredMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    '从图库选择 1~3 张静态图片，输入编辑指令。生成后可选择「入库」「覆盖原图」或「拒绝」。多图时按顺序传入，输出比例以最后一张为准。'
}

interface ImageEditState {
  hydrated: boolean
  libraryId: string
  size: string
  sourceMediaIds: string[]
  messages: ImageEditStoredMessage[]
  setHydrated: (hydrated: boolean) => void
  setLibraryId: (libraryId: string) => void
  setSize: (size: string) => void
  setSourceMediaIds: (ids: string[] | ((prev: string[]) => string[])) => void
  setMessages: (
    updater: ImageEditStoredMessage[] | ((prev: ImageEditStoredMessage[]) => ImageEditStoredMessage[])
  ) => void
  hydrateFromSession: (session: ImageEditSession) => void
  resetToWelcome: () => void
}

export const useImageEditStore = create<ImageEditState>((set) => ({
  hydrated: false,
  libraryId: '',
  size: '',
  sourceMediaIds: [],
  messages: [WELCOME],
  setHydrated: (hydrated) => set({ hydrated }),
  setLibraryId: (libraryId) => set({ libraryId }),
  setSize: (size) => set({ size }),
  setSourceMediaIds: (ids) =>
    set((state) => ({
      sourceMediaIds: typeof ids === 'function' ? ids(state.sourceMediaIds) : ids
    })),
  setMessages: (updater) =>
    set((state) => ({
      messages: typeof updater === 'function' ? updater(state.messages) : updater
    })),
  hydrateFromSession: (session) =>
    set({
      libraryId: session.libraryId,
      size: session.size,
      sourceMediaIds: session.sourceMediaIds,
      messages: session.messages.length > 0 ? session.messages : [WELCOME],
      hydrated: true
    }),
  resetToWelcome: () =>
    set({
      sourceMediaIds: [],
      messages: [WELCOME]
    })
}))

export function buildImageEditSession(
  state: Pick<ImageEditState, 'libraryId' | 'size' | 'sourceMediaIds' | 'messages'>
): ImageEditSession {
  return {
    libraryId: state.libraryId,
    size: state.size,
    sourceMediaIds: state.sourceMediaIds,
    messages: state.messages
  }
}
