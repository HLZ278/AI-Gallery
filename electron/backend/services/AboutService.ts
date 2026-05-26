import { app } from 'electron'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import type { AppAboutInfo } from '../../../shared/types'

interface ReleaseMeta {
  productName: string
  contactEmail: string
  copyright: string
  license: { name: string; file: string }
  release: { date: string; highlights: string[] }
}

function resolveConfigPath(filename: string): string {
  const paths = [
    join(app.getAppPath(), 'config', filename),
    join(__dirname, '../../config', filename),
    join(process.cwd(), 'config', filename)
  ]
  for (const p of paths) {
    if (existsSync(p)) return p
  }
  throw new Error(`Config file not found: ${filename}`)
}

export class AboutService {
  getInfo(): AppAboutInfo {
    const meta = JSON.parse(readFileSync(resolveConfigPath('release.meta.json'), 'utf-8')) as ReleaseMeta
    const licenseText = readFileSync(resolveConfigPath(meta.license.file), 'utf-8')
    return {
      productName: meta.productName,
      version: app.getVersion(),
      contactEmail: meta.contactEmail,
      licenseName: meta.license.name,
      licenseText,
      releaseDate: meta.release.date,
      releaseHighlights: meta.release.highlights,
      copyright: meta.copyright
    }
  }
}

export const aboutService = new AboutService()
