import type { AppConfig, MediaType } from './types'

export function getImageEditSupportedTypes(config: AppConfig): MediaType[] {
  return config.imageEdit.supportedMediaTypes
}

export function isImageEditSupportedType(config: AppConfig, mediaType: MediaType): boolean {
  return getImageEditSupportedTypes(config).includes(mediaType)
}

export function resolveImageEditMediaTypes(
  config: AppConfig,
  selected?: MediaType[]
): MediaType[] {
  const supported = getImageEditSupportedTypes(config)
  if (!selected?.length) return supported
  return selected.filter((type) => supported.includes(type))
}

export function formatImageEditExtensions(config: AppConfig): string {
  return config.imageEdit.allowedExtensions
    .map((ext) => ext.replace(/^\./, '').toUpperCase())
    .join('/')
}
