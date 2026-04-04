import type { Settings } from '~/types'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, localeLabels, translate } from '~/utils/i18n'

function normalizeLocale(input?: string): string {
  if (!input) return DEFAULT_LOCALE
  const lower = input.toLowerCase()
  if (lower === 'vi' || lower.startsWith('vi-')) return 'vi'
  return 'en'
}

export function useI18n() {
  const locale = useState<string>('ui-locale', () => DEFAULT_LOCALE)

  function setLocale(next?: string) {
    locale.value = normalizeLocale(next)
  }

  function syncFromSettings(settings?: Settings | null) {
    setLocale(typeof settings?.locale === 'string' ? settings.locale : DEFAULT_LOCALE)
  }

  function t(key: string, fallback?: string): string {
    return translate(locale.value, key, fallback)
  }

  return {
    locale,
    supportedLocales: SUPPORTED_LOCALES,
    localeLabels,
    setLocale,
    syncFromSettings,
    t,
  }
}
