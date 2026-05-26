import { readFileSync, existsSync, appendFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { APP_DISPLAY_NAME } from '../../../shared/appMeta'

const ARCHIVE_DIR_NAME = 'archive'

export interface ArchiveEntry {
  version: string
  date: string
  title: string
  changes: string[]
}

function getArchiveDir(): string {
  const dir = join(app.getAppPath(), 'docs', ARCHIVE_DIR_NAME)
  const fallback = join(process.cwd(), 'docs', ARCHIVE_DIR_NAME)
  for (const p of [dir, fallback]) {
    try {
      if (existsSync(p)) return p
    } catch {
      /* continue */
    }
  }
  const target = existsSync(join(process.cwd(), 'docs')) ? fallback : dir
  if (!existsSync(target)) mkdirSync(target, { recursive: true })
  return target
}

export class ChangeArchiveService {
  appendChangelog(entry: ArchiveEntry): void {
    const dir = getArchiveDir()
    const changelogPath = join(dir, 'CHANGELOG.md')
    const block = [
      '',
      `## [${entry.version}] - ${entry.date}`,
      '',
      `### ${entry.title}`,
      '',
      ...entry.changes.map((c) => `- ${c}`),
      ''
    ].join('\n')

    if (!existsSync(changelogPath)) {
      const header = `# ${APP_DISPLAY_NAME} 变更归档\n\n> 每一次功能变动均记录于此。\n`
      appendFileSync(changelogPath, header + block, 'utf-8')
    } else {
      appendFileSync(changelogPath, block, 'utf-8')
    }

    const versionFile = join(dir, 'versions', `${entry.version}.md`)
    const versionDir = join(dir, 'versions')
    if (!existsSync(versionDir)) mkdirSync(versionDir, { recursive: true })
    const versionContent = [
      `# ${APP_DISPLAY_NAME} ${entry.version}`,
      '',
      `**日期**: ${entry.date}`,
      '',
      `## ${entry.title}`,
      '',
      ...entry.changes.map((c) => `- ${c}`),
      ''
    ].join('\n')
    appendFileSync(versionFile, versionContent, 'utf-8')
  }

  writeSnapshot(filename: string, content: string): string {
    const dir = join(getArchiveDir(), 'snapshots')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const filePath = join(dir, filename)
    appendFileSync(filePath, content, 'utf-8')
    return filePath
  }
}

export const changeArchiveService = new ChangeArchiveService()

/** 应用启动时记录版本快照路径解析 */
export function resolveDocsPath(...segments: string[]): string {
  const candidates = [
    join(app.getAppPath(), 'docs', ...segments),
    join(process.cwd(), 'docs', ...segments)
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return join(process.cwd(), 'docs', ...segments)
}

export function readDocFile(...segments: string[]): string {
  return readFileSync(resolveDocsPath(...segments), 'utf-8')
}
