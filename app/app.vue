<script setup lang="ts">
import { computed } from 'vue'

const route = useRoute()
const { claudeDir, exists: claudeDirExists, load: loadConfig } = useClaudeDir()
const { settings, load: loadSettings } = useSettings()
const { syncFromSettings, t } = useI18n()
const { fetchAll: fetchAgents, agents } = useAgents()
const { fetchAll: fetchCommands, commands } = useCommands()
const { fetchAll: fetchPlugins, plugins } = usePlugins()
const { fetchAll: fetchSkills, skills } = useSkills()
const { fetchAll: fetchWorkflows, workflows } = useWorkflows()
const { fetchServers, servers: mcpServers } = useMCP()

const initialized = ref(false)
const showSearch = ref(false)
const sidebarCollapsed = useState('sidebar-collapsed', () => false)
const mobileSidebarOpen = ref(false)
const windowWidth = ref(1366)
const isMobileLayout = computed(() => windowWidth.value < 1024)

const { isPanelOpen: chatOpen } = useChat()
const { workingDir, displayPath, setWorkingDir, clearWorkingDir } = useWorkingDir()
const colorMode = useColorMode()

const showWorkingDirPopover = ref(false)
const workingDirInput = ref('')
const dirSuggestions = ref<{ name: string; path: string; hasChildren: boolean }[]>([])
const selectedSuggestionIdx = ref(-1)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

// Expose Promise for use in templates
const _Promise = Promise

function openWorkingDirPopover() {
  workingDirInput.value = workingDir.value
  dirSuggestions.value = []
  selectedSuggestionIdx.value = -1
  showWorkingDirPopover.value = true
  if (workingDirInput.value) fetchDirSuggestions(workingDirInput.value)
}

function saveWorkingDir() {
  setWorkingDir(workingDirInput.value)
  showWorkingDirPopover.value = false
  dirSuggestions.value = []
}

const browsing = ref(false)
async function browseFolder() {
  browsing.value = true
  try {
    const res = await $fetch<{ path: string | null }>('/api/dialog/select-directory', {
      method: 'POST'
    })
    if (res.path) {
      workingDirInput.value = res.path
      dirSuggestions.value = []
    }
  } catch (err) {
    console.error('Failed to open native folder picker:', err)
  } finally {
    browsing.value = false
  }
}

async function fetchDirSuggestions(path: string) {
  if (!path) { dirSuggestions.value = []; return }
  try {
    const data = await $fetch<{ directories: typeof dirSuggestions.value }>('/api/directories', { query: { path } })
    dirSuggestions.value = data.directories
    selectedSuggestionIdx.value = -1
  } catch {
    dirSuggestions.value = []
  }
}

function onDirInput() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => fetchDirSuggestions(workingDirInput.value), 150)
}

function selectSuggestion(suggestion: { name: string; path: string; hasChildren: boolean }) {
  workingDirInput.value = suggestion.path
  selectedSuggestionIdx.value = -1
  if (suggestion.hasChildren) {
    fetchDirSuggestions(suggestion.path)
  } else {
    dirSuggestions.value = []
  }
}

function onDirKeydown(e: KeyboardEvent) {
  if (!dirSuggestions.value.length) {
    if (e.key === 'Enter') { e.preventDefault(); saveWorkingDir() }
    return
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedSuggestionIdx.value = Math.min(selectedSuggestionIdx.value + 1, dirSuggestions.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedSuggestionIdx.value = Math.max(selectedSuggestionIdx.value - 1, -1)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (selectedSuggestionIdx.value >= 0) {
      selectSuggestion(dirSuggestions.value[selectedSuggestionIdx.value]!)
    } else {
      saveWorkingDir()
    }
  } else if (e.key === 'Escape') {
    dirSuggestions.value = []
    selectedSuggestionIdx.value = -1
  }
}

function toggleTheme() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}

function updateLayoutWidth() {
  if (import.meta.client) {
    windowWidth.value = window.innerWidth
  }
}

// Cmd+J to toggle chat
if (import.meta.client) {
  const chatHandler = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
      e.preventDefault()
      chatOpen.value = !chatOpen.value
    }
  }
  onMounted(() => document.addEventListener('keydown', chatHandler))
  onUnmounted(() => document.removeEventListener('keydown', chatHandler))
}

onMounted(async () => {
  updateLayoutWidth()
  window.addEventListener('resize', updateLayoutWidth)

  await loadConfig()
  await Promise.all([loadSettings(), fetchAgents(), fetchCommands(), fetchPlugins(), fetchSkills(), fetchWorkflows(), fetchServers()])
  syncFromSettings(settings.value)
  initialized.value = true
})

onUnmounted(() => {
  window.removeEventListener('resize', updateLayoutWidth)
})

const navLinks = computed(() => [
  { label: t('nav.dashboard'), icon: 'i-lucide-layout-dashboard', to: '/' },
  { label: t('nav.agents'), icon: 'i-lucide-cpu', to: '/agents' },
  { label: t('nav.workflows'), icon: 'i-lucide-git-branch', to: '/workflows' },
  { label: t('nav.commands'), icon: 'i-lucide-terminal', to: '/commands' },
  { label: t('nav.skills'), icon: 'i-lucide-sparkles', to: '/skills' },
  { label: t('nav.plugins'), icon: 'i-lucide-puzzle', to: '/plugins' },
  { label: t('nav.mcpServers'), icon: 'i-lucide-server', to: '/mcp' },
])

const navSecondary = computed(() => [
  { label: t('nav.explore'), icon: 'i-lucide-compass', to: '/explore' },
  { label: t('nav.graph'), icon: 'i-lucide-workflow', to: '/graph' },
  { label: t('nav.analytics'), icon: 'i-lucide-bar-chart-3', to: '/analytics' },
  { label: t('nav.cli'), icon: 'i-lucide-terminal-square', to: '/cli' },
  { label: t('nav.settings'), icon: 'i-lucide-settings', to: '/settings' },
])

function isActive(to: string) {
  if (to === '/') return route.path === '/'
  return route.path.startsWith(to)
}

function badgeFor(to: string) {
  if (to === '/agents') return agents.value.length || null
  if (to === '/commands') return commands.value.length || null
  if (to === '/skills') return skills.value.length || null
  if (to === '/plugins') return plugins.value.length || null
  if (to === '/workflows') return workflows.value.length || null
  if (to === '/mcp') return mcpServers.value.length || null
  return null
}

const sidebarWidth = computed(() => {
  if (isMobileLayout.value) return '0px'
  return sidebarCollapsed.value ? '56px' : '200px'
})
</script>

<template>
  <UApp>
    <div class="flex h-screen overflow-hidden relative" style="background: var(--surface-base);">
      <aside
        class="sidebar shrink-0 flex flex-col h-full overflow-hidden transition-all duration-300"
        :class="{ 'relative': !isMobileLayout, 'fixed inset-y-0 left-0 z-50': isMobileLayout, 'translate-x-0': !isMobileLayout || mobileSidebarOpen, '-translate-x-full': isMobileLayout && !mobileSidebarOpen }"
        :style="{
          width: isMobileLayout ? '280px' : sidebarWidth,
          background: 'var(--sidebar-bg)',
          borderRight: '1px solid var(--border-subtle)',
        }"
      >
        <div
          class="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-32 pointer-events-none"
          style="background: radial-gradient(ellipse, rgba(47, 111, 255, 0.14) 0%, transparent 70%);"
        />

        <div class="h-[56px] flex items-center relative" :class="sidebarCollapsed ? 'justify-center px-2' : 'gap-2.5 px-4'">
          <div
            class="flex items-center gap-2.5 min-w-0"
            :class="sidebarCollapsed ? 'justify-center cursor-pointer size-7 rounded-lg hover-bg transition-colors duration-150' : 'flex-grow'"
            :title="sidebarCollapsed ? 'Expand sidebar' : undefined"
            @click="sidebarCollapsed ? (sidebarCollapsed = false) : null"
          >
            <div
              class="size-7 rounded-lg flex items-center justify-center relative shrink-0"
              style="background: linear-gradient(135deg, rgba(47, 111, 255, 0.08) 0%, rgba(5, 220, 163, 0.04) 100%); border: 1px solid rgba(47, 111, 255, 0.15);"
            >
              <!-- Inline Custom SVG Logo representing Cog + Mint Leaf + Cognitive Node -->
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" class="size-4">
                <defs>
                  <linearGradient id="logoCogGrad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stop-color="var(--accent)" />
                    <stop offset="100%" stop-color="var(--accent-secondary)" />
                  </linearGradient>
                  <linearGradient id="logoLeafGrad" x1="16" y1="8" x2="28" y2="20" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stop-color="#05DCA3" />
                    <stop offset="100%" stop-color="#34D399" />
                  </linearGradient>
                </defs>
                <path d="M 16,4 A 12,12 0 0,0 16,28 L 16,24 A 8,8 0 0,1 16,8 Z" fill="url(#logoCogGrad)" />
                <rect x="7.5" y="4.5" width="3.5" height="3.5" transform="rotate(-30 7.5 4.5)" fill="url(#logoCogGrad)" rx="0.75" />
                <rect x="2" y="14" width="4.5" height="4" fill="url(#logoCogGrad)" rx="0.75" />
                <rect x="5.8" y="24.2" width="3.5" height="3.5" transform="rotate(30 5.8 24.2)" fill="url(#logoCogGrad)" rx="0.75" />
                <path d="M 16,4 C 24.5,4 28,11.5 28,16 C 28,23.5 21,28 16,28 C 16,28 19.5,20 18.5,16 C 17.5,12 16,4 16,4 Z" fill="url(#logoLeafGrad)" />
                <circle cx="16" cy="16" r="2.5" fill="#ffffff" opacity="0.95" />
              </svg>
            </div>
            <div v-if="!sidebarCollapsed" class="flex-grow flex flex-col min-w-0">
              <span class="text-[13px] font-bold tracking-tight" style="color: var(--text-primary); font-family: var(--font-sans); line-height: 1.25;">
                COGMINT
              </span>
              <span class="text-[8px] font-mono tracking-widest uppercase" style="color: var(--text-disabled); font-size: 8px; line-height: 1;">
                Orchestration OS
              </span>
            </div>
          </div>
          <button
            v-if="!sidebarCollapsed"
            class="size-7 flex items-center justify-center rounded-lg transition-all duration-150 focus-ring press-scale shrink-0 hover-bg"
            :class="isMobileLayout ? 'hidden' : 'hidden md:flex'"
            style="color: var(--text-tertiary);"
            title="Collapse sidebar"
            @click="isMobileLayout ? (mobileSidebarOpen = false) : (sidebarCollapsed = true)"
          >
            <UIcon name="i-lucide-panel-left-close" class="size-4" />
          </button>
        </div>

        <nav class="flex-1 pt-1 space-y-0.5 overflow-y-auto" :class="sidebarCollapsed ? 'px-1.5' : 'px-2.5'">
          <NuxtLink
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="nav-item group flex items-center rounded-lg text-[13px] transition-all duration-150 relative focus-ring"
            :class="[
              sidebarCollapsed ? 'justify-center px-0 py-2' : 'gap-2.5 px-3 py-[7px]',
              { 'nav-item--active': isActive(link.to) }
            ]"
            :style="{
              color: isActive(link.to) ? 'var(--text-primary)' : 'var(--text-tertiary)',
              fontWeight: isActive(link.to) ? '500' : '400',
              background: isActive(link.to) ? 'var(--surface-hover)' : undefined,
            }"
            :title="sidebarCollapsed ? link.label : undefined"
          >
            <UIcon :name="link.icon" class="size-[15px] shrink-0 transition-colors duration-150" :style="{ color: isActive(link.to) ? 'var(--accent)' : undefined }" />
            <template v-if="!sidebarCollapsed">
              <span class="flex-1" style="font-family: var(--font-sans);">{{ link.label }}</span>
              <span
                v-if="badgeFor(link.to)"
                class="font-mono text-[10px] tabular-nums transition-colors duration-150"
                :style="{ color: isActive(link.to) ? 'var(--accent)' : 'var(--text-disabled)' }"
              >
                {{ badgeFor(link.to) }}
              </span>
            </template>
          </NuxtLink>

          <div class="my-3" :class="sidebarCollapsed ? 'mx-1' : 'mx-2'" style="border-top: 1px solid var(--border-subtle);" />

          <NuxtLink
            v-for="link in navSecondary"
            :key="link.to"
            :to="link.to"
            class="nav-item group flex items-center rounded-lg text-[13px] transition-all duration-150 relative focus-ring"
            :class="sidebarCollapsed ? 'justify-center px-0 py-2' : 'gap-2.5 px-3 py-[7px]'"
            :style="{
              color: isActive(link.to) ? 'var(--text-primary)' : 'var(--text-tertiary)',
              fontWeight: isActive(link.to) ? '500' : '400',
              background: isActive(link.to) ? 'var(--surface-hover)' : undefined,
            }"
            :title="sidebarCollapsed ? link.label : undefined"
          >
            <UIcon :name="link.icon" class="size-[15px] shrink-0 transition-colors duration-150" :style="{ color: isActive(link.to) ? 'var(--accent)' : undefined }" />
            <span v-if="!sidebarCollapsed" style="font-family: var(--font-sans);">{{ link.label }}</span>
          </NuxtLink>
        </nav>

        <div :class="sidebarCollapsed ? 'px-1.5 pb-2.5' : 'px-2.5 pb-2.5'">
          <button
            class="w-full flex items-center rounded-lg transition-all duration-150 focus-ring cursor-pointer press-scale btn-search-trigger"
            :class="sidebarCollapsed ? 'justify-center px-0 py-2' : 'gap-2 px-3 py-2'"
             :title="sidebarCollapsed ? `${t('shell.search')} (⌘K)` : undefined"
            @click="showSearch = true"
          >
            <UIcon name="i-lucide-search" class="size-3.5" />
            <template v-if="!sidebarCollapsed">
               <span class="text-[12px] flex-1 text-left" style="font-family: var(--font-sans);">{{ t('shell.search') }}</span>

              <kbd class="text-[9px] font-mono px-1.5 py-0.5 rounded" style="background: var(--badge-subtle-bg); color: var(--text-disabled);">⌘K</kbd>
            </template>
          </button>
        </div>

        <div :class="sidebarCollapsed ? 'px-1.5 pb-1' : 'px-2.5 pb-1'">
          <button
            class="w-full flex items-center rounded-lg transition-all duration-150 focus-ring cursor-pointer press-scale hover-bg"
            :class="sidebarCollapsed ? 'justify-center px-0 py-2' : 'gap-2 px-3 py-2'"
            :style="{
              color: chatOpen ? 'var(--accent)' : 'var(--text-tertiary)',
              background: chatOpen ? 'var(--accent-muted)' : 'transparent',
            }"
             :title="sidebarCollapsed ? `${t('shell.claude')} (⌘J)` : undefined"

            @click="chatOpen = !chatOpen"
          >
            <div class="size-4 relative flex items-center justify-center shrink-0">
              <UIcon name="i-lucide-zap" class="size-4" />
              <div
                v-if="chatOpen"
                class="absolute -top-0.5 -right-0.5 size-1.5 rounded-full"
                style="background: var(--accent); box-shadow: 0 0 8px var(--accent-glow);"
              />
            </div>
            <template v-if="!sidebarCollapsed">
               <span class="text-[12px] flex-1 text-left" style="font-family: var(--font-sans);">{{ t('shell.claude') }}</span>

              <kbd class="text-[9px] font-mono px-1.5 py-0.5 rounded" style="background: var(--badge-subtle-bg); color: var(--text-disabled);">⌘J</kbd>
            </template>
          </button>
        </div>

        <div :class="sidebarCollapsed ? 'px-1.5 pb-1' : 'px-2.5 pb-1'">
          <ClientOnly>
            <button
              class="w-full flex items-center rounded-lg transition-all duration-150 focus-ring press-scale hover-bg"
              :class="sidebarCollapsed ? 'justify-center px-0 py-2' : 'gap-2 px-3 py-2'"
              style="color: var(--text-tertiary);"
               :title="sidebarCollapsed ? (colorMode.value === 'dark' ? t('shell.lightMode') : t('shell.darkMode')) : undefined"

              @click="toggleTheme"
            >
              <UIcon :name="colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon'" class="size-4" />
              <span v-if="!sidebarCollapsed" class="text-[12px]" style="font-family: var(--font-sans);">
                 {{ colorMode.value === 'dark' ? t('shell.lightMode') : t('shell.darkMode') }}

              </span>
            </button>
          </ClientOnly>
        </div>

        <div :class="sidebarCollapsed ? 'px-1.5 pb-2.5' : 'px-2.5 pb-2.5'" style="border-top: 1px solid var(--border-subtle); padding-top: 0.75rem;">
          <UPopover v-model:open="showWorkingDirPopover" :ui="{ content: 'w-[280px]' }">
            <button
              class="w-full flex items-center rounded-lg transition-all duration-150 focus-ring cursor-pointer press-scale btn-folder-trigger"
              :class="sidebarCollapsed ? 'justify-center px-0 py-2' : 'gap-2 px-3 py-2 text-left'"
              style="border: 1px solid var(--border-subtle);"
               :title="sidebarCollapsed ? (workingDir || t('shell.setProjectDirectory')) : undefined"

              @click="openWorkingDirPopover"
            >
              <UIcon name="i-lucide-folder" class="size-3.5 shrink-0" :style="{ color: workingDir ? 'var(--accent)' : undefined }" />
              <template v-if="!sidebarCollapsed">
                <div class="flex-1 min-w-0">
                  <div v-if="workingDir" class="font-mono text-[10px] truncate" style="color: var(--text-secondary);">
                    {{ displayPath }}
                  </div>
                  <div v-else class="text-[11px]" style="font-family: var(--font-sans);">
                     {{ t('shell.setProjectDirectory') }}

                  </div>
                </div>
                <UIcon name="i-lucide-pencil" class="size-3 shrink-0" style="color: var(--text-disabled);" />
              </template>
            </button>
            <template #content>
              <div class="p-3 space-y-3">
                 <div class="text-[13px] font-semibold" style="color: var(--text-primary); font-family: var(--font-sans);">{{ t('shell.workingDirectory') }}</div>

                <p class="text-[11px] leading-relaxed" style="color: var(--text-secondary);">
                  Set the project directory for all chat conversations. Claude will operate in this directory.
                </p>
                <div class="flex gap-2">
                  <div class="relative flex-1">
                    <input
                      v-model="workingDirInput"
                      class="field-input text-[12px] font-mono w-full"
                      placeholder="/path/to/your/project"
                      autocomplete="off"
                      @input="onDirInput"
                      @keydown="onDirKeydown"
                    />
                    <div
                      v-if="dirSuggestions.length"
                      class="absolute left-0 right-0 z-10 mt-1 rounded-lg overflow-hidden max-h-[200px] overflow-y-auto shadow-lg"
                      style="border: 1px solid var(--border-subtle); background: var(--surface-raised);"
                    >
                      <button
                        v-for="(suggestion, idx) in dirSuggestions"
                        :key="suggestion.path"
                        type="button"
                        class="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors duration-75"
                        :style="{
                          background: idx === selectedSuggestionIdx ? 'var(--accent-muted)' : 'transparent',
                          color: idx === selectedSuggestionIdx ? 'var(--text-primary)' : 'var(--text-secondary)',
                        }"
                        @click="selectSuggestion(suggestion)"
                        @mouseenter="selectedSuggestionIdx = idx"
                      >
                        <UIcon
                          :name="suggestion.hasChildren ? 'i-lucide-folder' : 'i-lucide-folder-dot'"
                          class="size-3.5 shrink-0"
                          :style="{ color: idx === selectedSuggestionIdx ? 'var(--accent)' : 'var(--text-disabled)' }"
                        />
                        <span class="text-[11px] font-mono truncate">{{ suggestion.name }}</span>
                        <UIcon
                          v-if="suggestion.hasChildren"
                          name="i-lucide-chevron-right"
                          class="size-3 shrink-0 ml-auto"
                          style="color: var(--text-disabled);"
                        />
                      </button>
                    </div>
                  </div>
                  <UButton
                    icon="i-lucide-folder-open"
                    variant="soft"
                    size="sm"
                    class="shrink-0"
                    title="Browse Folder"
                    :loading="browsing"
                    @click="browseFolder"
                  />
                </div>
                <div class="flex items-center justify-between">
                  <button
                    v-if="workingDir"
                    class="text-[11px] font-medium px-2 py-1 rounded hover-bg"
                    style="color: var(--error);"
                    @click="clearWorkingDir(); showWorkingDirPopover = false"
                  >
                    Clear
                  </button>
                  <div v-else />
                  <UButton label="Save" size="xs" @click="saveWorkingDir" />
                </div>
              </div>
            </template>
          </UPopover>
          <div v-if="!sidebarCollapsed" class="font-mono text-[9px] truncate tracking-wide mt-1.5 px-1" style="color: var(--text-disabled);">
            {{ claudeDir || 'No config directory' }}
          </div>
        </div>
      </aside>

      <div
        v-if="isMobileLayout && mobileSidebarOpen"
        class="fixed inset-0 z-40"
        style="background: rgba(2, 6, 23, 0.55); backdrop-filter: blur(2px);"
        @click="mobileSidebarOpen = false"
      />

      <main class="flex-1 min-w-0 h-full overflow-y-auto" :style="{ background: 'var(--surface-base)' }">
        <div v-if="isMobileLayout" class="sticky top-0 z-30 px-3 py-2 border-b" style="background: color-mix(in srgb, var(--surface-base) 90%, #2f6fff 10%); border-color: var(--border-subtle);">
          <button
            class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-medium"
            style="background: var(--surface-raised); color: var(--text-primary); border: 1px solid var(--border-subtle);"
            @click="mobileSidebarOpen = true"
          >
            <UIcon name="i-lucide-panel-left" class="size-4" />
            Menu
          </button>
        </div>

        <SetupWizard
          v-if="initialized && !claudeDirExists"
          @complete="async () => { await loadConfig(); await _Promise.all([fetchAgents(), fetchCommands(), fetchPlugins(), fetchSkills()]) }"
        />

         <div v-show="initialized && claudeDirExists" class="h-full min-w-0">

          <NuxtPage />
        </div>
        <div v-if="!initialized" class="flex items-center justify-center h-full">
          <UIcon name="i-lucide-loader-2" class="size-5 animate-spin" style="color: var(--text-disabled);" />
        </div>
      </main>
    </div>
    <GlobalSearch />
    <ChatPanel v-model:open="chatOpen" />
    <FileEditorSidebar />
  </UApp>
</template>

<style scoped>
.nav-item {
  transition: background 0.15s, color 0.15s;
}
.nav-item:hover {
  background: var(--surface-hover);
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
