import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { ImageGenSession } from '../../../shared/types'

const SESSION_FILENAME = 'imageGenSession.json'

function getSessionPath(): string {
  const dir = app.getPath('userData')
  mkdirSync(dir, { recursive: true })
  return join(dir, SESSION_FILENAME)
}

const WELCOME: ImageGenSession['messages'][number] = {
  id: 'welcome',
  role: 'assistant',
  content:
    '描述你想生成的画面，我会调用千问文生图模型为你创作。生成后请预览并选择「接受并保存」或「拒绝」。未指定图库时将保存到第一个图库。'
}

export class ImageGenSessionService {
  load(): ImageGenSession {
    const path = getSessionPath()
    if (!existsSync(path)) {
      return { libraryId: '', size: '', messages: [WELCOME] }
    }
    try {
      const raw = JSON.parse(readFileSync(path, 'utf-8')) as ImageGenSession
      return {
        libraryId: raw.libraryId ?? '',
        size: raw.size ?? '',
        messages: Array.isArray(raw.messages) && raw.messages.length > 0 ? raw.messages : [WELCOME]
      }
    } catch {
      return { libraryId: '', size: '', messages: [WELCOME] }
    }
  }

  save(session: ImageGenSession): void {
    writeFileSync(getSessionPath(), JSON.stringify(session, null, 2), 'utf-8')
  }
}

export const imageGenSessionService = new ImageGenSessionService()
