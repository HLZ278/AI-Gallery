import { copyFileSync, existsSync, renameSync, unlinkSync } from 'fs'

export function moveFileSync(src: string, dest: string): void {
  if (existsSync(dest)) unlinkSync(dest)
  try {
    renameSync(src, dest)
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : ''
    if (code !== 'EXDEV') throw err
    copyFileSync(src, dest)
    unlinkSync(src)
  }
}
