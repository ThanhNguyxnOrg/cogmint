import { ref, computed } from 'vue'
import { getModelLabel } from '~/utils/models'

export interface ProbedModel {
  value: string
  displayName: string
  description: string
  contextWindow: number
  pricing: {
    input: number
    output: number
    cached: number
  }
}

export interface ClaudeCliInfo {
  supportedModels: ProbedModel[]
  appliedSettings: any
  lastProbed: number
}

const supportedModels = ref<ProbedModel[]>([])
const appliedSettings = ref<any>({})
const loading = ref(false)
const loaded = ref(false)
const error = ref<string | null>(null)

export function useClaudeInfo() {
  async function loadInfo(force = false) {
    if (loaded.value && !force && !error.value) return

    loading.value = true
    error.value = null
    try {
      const data = await $fetch<ClaudeCliInfo>('/api/claude/info', {
        query: force ? { refresh: 'true' } : {},
      })

      supportedModels.value = data.supportedModels || []
      appliedSettings.value = data.appliedSettings || {}
      loaded.value = true
    } catch (err: any) {
      console.error('[useClaudeInfo] Failed to fetch Claude CLI info:', err)
      error.value = err.message || 'Failed to load Claude CLI information'
    } finally {
      loading.value = false
    }
  }

  const activeDefaultModel = computed(() => {
    return appliedSettings.value?.applied?.model || 'sonnet'
  })

  const modelOptionsChat = computed(() => {
    const defaultModelVal = appliedSettings.value?.applied?.model
    const defaultLabel = defaultModelVal ? `Default (${getModelLabel(defaultModelVal)})` : 'Default'

    const options = [
      {
        value: 'default',
        label: defaultLabel,
        description: 'Uses whatever model is set in your Claude Code config.'
      }
    ]

    if (supportedModels.value.length === 0) {
      // Fallback options matching existing structure if backend probe fails
      options.push(
        { value: 'opus', label: 'Opus', description: 'Most capable. Best for complex reasoning and nuanced tasks.' },
        { value: 'sonnet', label: 'Sonnet', description: 'Best balance of speed and quality. Good for most tasks.' },
        { value: 'haiku', label: 'Haiku', description: 'Fastest and cheapest. Great for simple, repetitive tasks.' },
      )
      return options
    }

    options.push(...supportedModels.value.map((m) => ({
      value: m.value,
      label: m.displayName || m.value,
      description: m.description || '',
    })))

    return options
  })

  function getModelContextWindow(model: string | undefined): number {
    let lookup = model
    if (!lookup || lookup === 'default') {
      lookup = activeDefaultModel.value || 'sonnet'
    }

    if (!lookup) return 200_000

    if (supportedModels.value.length > 0) {
      // Direct match
      let match = supportedModels.value.find((m) => m.value === lookup)
      if (!match) {
        // Fuzzy match
        const lower = lookup.toLowerCase()
        match = supportedModels.value.find(
          (m) => m.value.toLowerCase().includes(lower) || lower.includes(m.value.toLowerCase())
        )
      }
      if (match) return match.contextWindow
    }

    // Static fallback matching utils/models.ts
    if (!lookup) return 200_000
    const lower = lookup.toLowerCase()
    if (lower.includes('opus')) return 1_000_000
    if (lower.includes('sonnet')) return 200_000
    if (lower.includes('haiku')) return 200_000
    return 200_000
  }

  return {
    supportedModels,
    appliedSettings,
    loading,
    loaded,
    error,
    activeDefaultModel,
    modelOptionsChat,
    loadInfo,
    getModelContextWindow,
  }
}
