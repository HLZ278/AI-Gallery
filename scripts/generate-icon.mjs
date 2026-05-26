import { writeFileSync, renameSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const buildDir = join(root, 'build')
const source = join(buildDir, 'icon.png')
const optimized = join(buildDir, 'icon-opt.png')

if (!existsSync(source)) {
  console.error('缺少 build/icon.png，请先放置源图标')
  process.exit(1)
}

const input = existsSync(optimized) ? optimized : source
const sizes = [16, 32, 48, 64, 128, 256]

await sharp(input)
  .resize(512, 512, { fit: 'cover' })
  .png({ compressionLevel: 9 })
  .toFile(join(buildDir, 'icon.tmp.png'))

renameSync(join(buildDir, 'icon.tmp.png'), source)

const pngBuffers = await Promise.all(
  sizes.map((size) => sharp(source).resize(size, size).png().toBuffer())
)

const ico = await pngToIco(pngBuffers)
writeFileSync(join(buildDir, 'icon.ico'), ico)

await sharp(source).resize(512, 512).png().toFile(join(root, 'public', 'icon.png'))

console.log('已生成 build/icon.png、build/icon.ico、public/icon.png')
