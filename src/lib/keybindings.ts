export type PlatformKind = 'macos' | 'windows' | 'linux'

export function detectPlatform(): PlatformKind {
  if (typeof navigator === 'undefined') return 'linux'
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('mac')) return 'macos'
  if (ua.includes('win')) return 'windows'
  return 'linux'
}

export function isModKey(e: KeyboardEvent, platform = detectPlatform()): boolean {
  return platform === 'macos' ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey
}

/** Formats mac-style glyphs ("⌘⇧A") into Ctrl+Shift+A on Windows/Linux. */
export function formatShortcut(macGlyphs: string, platform = detectPlatform()): string {
  if (platform === 'macos') return macGlyphs
  const parts: string[] = []
  let key = ''
  for (const ch of macGlyphs) {
    if (ch === '⌘') parts.push('Ctrl')
    else if (ch === '⇧') parts.push('Shift')
    else if (ch === '⌥') parts.push('Alt')
    else key += ch
  }
  return [...parts, key].filter(Boolean).join('+')
}
