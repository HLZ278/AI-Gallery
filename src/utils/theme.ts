export type ResolvedTheme = 'light' | 'dark'
export type ThemePreference = 'system' | 'light' | 'dark'

export function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'system') return getSystemTheme()
  return preference
}

export function subscribeSystemTheme(onChange: (theme: ResolvedTheme) => void): () => void {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = () => onChange(getSystemTheme())
  media.addEventListener('change', handler)
  return () => media.removeEventListener('change', handler)
}
