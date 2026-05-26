import { useNavigate } from 'react-router-dom'
import type { MediaItem } from '../../shared/types'
import { useAppStore } from '../store/appStore'
import { buildImageEditSession, useImageEditStore } from '../store/imageEditStore'
import { isImageEditSupportedType } from '../../shared/imageEditPolicy'
import { toast } from '../store/toastStore'

export function useNavigateToImageEdit() {
  const navigate = useNavigate()
  const config = useAppStore((s) => s.config)

  return async (items: MediaItem[]) => {
    if (!config) {
      toast('配置尚未加载', 'error')
      return
    }

    const supported = items.filter((item) => isImageEditSupportedType(config, item.mediaType))
    if (supported.length === 0) {
      toast('所选媒体类型不支持 AI 编辑', 'error')
      return
    }

    const max = config.imageEdit.maxInputImages
    const picked = supported.slice(0, max)
    const libraryIds = new Set(picked.map((item) => item.libraryId))
    if (libraryIds.size > 1) {
      toast('请选择同一图库内的图片', 'error')
      return
    }

    const { setLibraryId, setSourceMediaIds, setMessages } = useImageEditStore.getState()
    setLibraryId(picked[0].libraryId)
    setSourceMediaIds(picked.map((item) => item.id))

    const session = buildImageEditSession({
      libraryId: picked[0].libraryId,
      size: useImageEditStore.getState().size,
      sourceMediaIds: picked.map((item) => item.id),
      messages: useImageEditStore.getState().messages
    })
    await window.api.imageEdit.saveSession(session)
    navigate('/image-edit')
  }
}
