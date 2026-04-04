export const DEFAULT_LOCALE = 'en' as const

export const SUPPORTED_LOCALES = ['en', 'vi'] as const

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

export const localeLabels: Record<SupportedLocale, string> = {
  en: 'English',
  vi: 'Tiếng Việt',
}

type Dictionary = Record<string, string>

type LocaleDictionaries = Record<SupportedLocale, Dictionary>

const dictionaries: LocaleDictionaries = {
  en: {
    'nav.dashboard': 'Dashboard',
    'nav.agents': 'Agents',
    'nav.workflows': 'Workflows',
    'nav.commands': 'Commands',
    'nav.skills': 'Skills',
    'nav.plugins': 'Plugins',
    'nav.mcpServers': 'MCP Servers',
    'nav.explore': 'Explore',
    'nav.graph': 'Graph',
    'nav.cli': 'CLI',
    'nav.settings': 'Settings',
    'shell.brand.name': 'COGMINT',
    'shell.brand.tagline': 'Agent Orchestration OS',
    'shell.search': 'Search',
    'shell.claude': 'Claude',
    'shell.lightMode': 'Light mode',
    'shell.darkMode': 'Dark mode',
    'shell.setProjectDirectory': 'Set project directory',
    'shell.workingDirectory': 'Working Directory',

    'settings.title': 'Settings',
    'settings.general': 'General',
    'settings.alwaysThinking': 'Always Thinking',
    'settings.alwaysThinkingDescription': 'When enabled, Claude spends extra reasoning time for complex prompts. Higher quality outputs, but slower and more expensive.',
    'settings.statusLine': 'Status Line',
    'settings.statusLineDescription': 'Show custom runtime status in Claude Code by running a command.',
    'settings.extensions': 'Extensions',
    'settings.githubImports': 'GitHub Imports',
    'settings.automations': 'Automations',
    'settings.noAutomations': 'No automations configured.',
    'settings.locale': 'Language',
    'settings.localeDescription': 'Choose your interface language. English is the default baseline.',
    'settings.saveLanguage': 'Save Language',
  },
  vi: {
    'nav.dashboard': 'Bảng điều khiển',
    'nav.agents': 'Agents',
    'nav.workflows': 'Quy trình',
    'nav.commands': 'Lệnh',
    'nav.skills': 'Kỹ năng',
    'nav.plugins': 'Plugins',
    'nav.mcpServers': 'MCP Servers',
    'nav.explore': 'Khám phá',
    'nav.graph': 'Đồ thị',
    'nav.cli': 'CLI',
    'nav.settings': 'Cài đặt',
    'shell.brand.name': 'COGMINT',
    'shell.brand.tagline': 'Hệ điều phối Agent',
    'shell.search': 'Tìm kiếm',
    'shell.claude': 'Claude',
    'shell.lightMode': 'Chế độ sáng',
    'shell.darkMode': 'Chế độ tối',
    'shell.setProjectDirectory': 'Đặt thư mục dự án',
    'shell.workingDirectory': 'Thư mục làm việc',

    'settings.title': 'Cài đặt',
    'settings.general': 'Tổng quan',
    'settings.alwaysThinking': 'Always Thinking',
    'settings.alwaysThinkingDescription': 'Khi bật, Claude sẽ dành thêm thời gian suy luận cho prompt phức tạp. Chất lượng tốt hơn nhưng chậm và tốn tài nguyên hơn.',
    'settings.statusLine': 'Thanh trạng thái',
    'settings.statusLineDescription': 'Hiển thị trạng thái chạy trong Claude Code bằng một lệnh tuỳ chỉnh.',
    'settings.extensions': 'Extensions',
    'settings.githubImports': 'Nhập từ GitHub',
    'settings.automations': 'Tự động hóa',
    'settings.noAutomations': 'Chưa có tự động hóa nào.',
    'settings.locale': 'Ngôn ngữ',
    'settings.localeDescription': 'Chọn ngôn ngữ giao diện. English là mặc định.',
    'settings.saveLanguage': 'Lưu ngôn ngữ',
  },
}

function normalizeLocale(locale?: string): SupportedLocale {
  if (!locale) return DEFAULT_LOCALE
  const lower = locale.toLowerCase()
  if (lower === 'vi' || lower.startsWith('vi-')) return 'vi'
  return 'en'
}

export function getLocaleDictionary(locale?: string): Dictionary {
  return dictionaries[normalizeLocale(locale)]
}

export function translate(locale: string | undefined, key: string, fallback?: string): string {
  const dict = getLocaleDictionary(locale)
  if (key in dict) return dict[key] as string

  const english = dictionaries.en
  if (key in english) return english[key] as string

  return fallback ?? key
}
