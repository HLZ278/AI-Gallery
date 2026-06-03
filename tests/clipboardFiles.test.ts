import { describe, expect, it } from 'vitest'
import { resolve } from 'path'
import { buildWindowsDropFilesBuffer, isImageMediaType } from '../electron/backend/infra/ClipboardFiles'

describe('isImageMediaType', () => {
  it('treats photo and gif as image types', () => {
    expect(isImageMediaType('photo')).toBe(true)
    expect(isImageMediaType('gif')).toBe(true)
  })

  it('treats video as non-image for single-image paste path', () => {
    expect(isImageMediaType('video')).toBe(false)
  })
})

describe('buildWindowsDropFilesBuffer', () => {
  it('writes DROPFILES header with pFiles offset 20 and fWide=true', () => {
    const buf = buildWindowsDropFilesBuffer(['C:\\photos\\a.jpg'])
    expect(buf.length).toBeGreaterThan(20)
    expect(buf.readUInt32LE(0)).toBe(20)
    expect(buf.readUInt32LE(16)).toBe(1)
  })

  it('encodes absolute paths as UTF-16LE double-null terminated list', () => {
    const buf = buildWindowsDropFilesBuffer(['C:\\a.jpg', 'D:\\b.png'])
    const list = buf.subarray(20).toString('utf16le')
    expect(list).toContain(resolve('C:\\a.jpg'))
    expect(list).toContain(resolve('D:\\b.png'))
    expect(list.endsWith('\0\0')).toBe(true)
  })
})
