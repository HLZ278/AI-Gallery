import type { MediaItem, MediaType } from '../../shared/types'
import { ContextMenu, type ContextMenuItem } from './ContextMenu'
import { fileNameFromPath } from '../utils/fileUrl'

export type MediaContextAction =
  | 'copy'
  | 'copyPath'
  | 'lanShare'
  | 'sendToEdit'
  | 'removeFromDb'
  | 'deleteFromDisk'
  | 'showInFolder'

function buildMenuItems(mediaType: MediaType, variant: 'full' | 'preview'): ContextMenuItem[] {
  if (variant === 'preview') {
    return [
      { id: 'copy', label: '复制文件' },
      { id: 'showInFolder', label: '打开文件所在位置' }
    ]
  }

  const items: ContextMenuItem[] = [
    { id: 'copy', label: '复制文件' },
    { id: 'copyPath', label: '复制路径' },
    { id: 'lanShare', label: '局域网分享' },
    { id: 'showInFolder', label: '打开文件所在位置' }
  ]

  if (mediaType !== 'video') {
    items.splice(3, 0, { id: 'sendToEdit', label: '发送到 AI 编辑' })
  }

  items.push({ id: 'removeFromDb', label: '从数据库移除' }, { id: 'deleteFromDisk', label: '从本地删除', danger: true })
  return items
}

interface Props {
  item: MediaItem
  x: number
  y: number
  variant?: 'full' | 'preview'
  onAction: (action: MediaContextAction) => void
  onClose: () => void
}

export function MediaContextMenu({ item, x, y, variant = 'full', onAction, onClose }: Props) {
  return (
    <ContextMenu
      title={fileNameFromPath(item.filePath)}
      x={x}
      y={y}
      items={buildMenuItems(item.mediaType, variant)}
      onSelect={(id) => onAction(id as MediaContextAction)}
      onClose={onClose}
    />
  )
}
