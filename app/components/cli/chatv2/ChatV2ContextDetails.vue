<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { ContextMetrics } from '~/types'

const props = defineProps<{
  metrics: ContextMetrics
  sessionId?: string
}>()

const formatNumber = (num: number) => {
  return new Intl.NumberFormat().format(num)
}

const contextPercentage = computed(() => {
  return Math.round(props.metrics.contextWindow.percentage)
})

const getStatusColor = (percentage = contextPercentage.value) => {
  if (percentage < 50) return '#22c55e' // Green
  if (percentage < 75) return '#eab308' // Yellow
  if (percentage < 90) return '#f97316' // Orange
  return '#ef4444' // Red
}

// SDK dynamic breakdown info
const sdkContext = ref<any>(null)
const loading = ref(false)
const error = ref<string | null>(null)

async function fetchSdkContext() {
  if (!props.sessionId || props.sessionId.startsWith('new-session-') || props.sessionId.startsWith('local-')) {
    sdkContext.value = null
    return
  }

  loading.value = true
  error.value = null
  try {
    const data = await $fetch<any>('/api/claude/context', {
      query: { sessionId: props.sessionId },
    })
    sdkContext.value = data
  } catch (err: any) {
    console.error('[ContextDetails] Failed to fetch context usage details:', err)
    error.value = err.message || 'Failed to load details'
  } finally {
    loading.value = false
  }
}

watch(() => props.sessionId, () => {
  fetchSdkContext()
}, { immediate: true })

const getCategoryColor = (colorName: string) => {
  switch (colorName) {
    case 'warning': return '#f59e0b'
    case 'error': return '#ef4444'
    case 'info': return '#3b82f6'
    case 'success': return '#22c55e'
    default: return 'var(--text-secondary)'
  }
}
</script>

<template>
  <div class="p-4 space-y-6">
    <!-- Summary Section -->
    <div class="space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h4 class="text-[11px] font-bold uppercase tracking-wider text-tertiary" style="color: var(--text-tertiary);">Current Usage</h4>
        <span class="text-[11px] font-mono" :style="{ color: getStatusColor() }">{{ contextPercentage }}%</span>
      </div>
      
      <!-- Big Progress Bar -->
      <div class="h-2 w-full rounded-full overflow-hidden" style="background: var(--surface-raised);">
        <div 
          class="h-full transition-all duration-500 rounded-full"
          :style="{ 
            width: `${contextPercentage}%`,
            background: getStatusColor()
          }"
        />
      </div>

      <div class="flex flex-wrap justify-between text-[12px] gap-2">
        <span class="min-w-0 break-words" style="color: var(--text-secondary);">{{ formatNumber(metrics.contextWindow.used) }} tokens used</span>
        <span style="color: var(--text-tertiary);">{{ formatNumber(metrics.contextWindow.total) }} total</span>
      </div>
    </div>

    <!-- SDK Context Details Loading -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-8 space-y-2">
      <UIcon name="i-lucide-loader-2" class="size-5 animate-spin animate-duration-1000" style="color: var(--text-tertiary);" />
      <span class="text-[11px]" style="color: var(--text-tertiary);">Fetching CLI token statistics...</span>
    </div>

    <div v-else-if="sdkContext" class="space-y-6">
      <!-- SDK Categories Breakdown -->
      <div v-if="sdkContext.categories && sdkContext.categories.length > 0" class="space-y-3">
        <h4 class="text-[11px] font-bold uppercase tracking-wider" style="color: var(--text-tertiary);">Declassified Token Breakdown</h4>
        <div class="space-y-2.5">
          <div 
            v-for="cat in sdkContext.categories" 
            :key="cat.name"
            class="p-2.5 rounded-lg space-y-1.5"
            style="background: var(--surface-raised);"
          >
            <div class="flex items-center justify-between text-[12px]">
              <span class="font-medium" style="color: var(--text-primary);">{{ cat.name }}</span>
              <span class="font-mono text-[11px]" style="color: var(--text-secondary);">{{ formatNumber(cat.tokens) }} tokens</span>
            </div>
            <div class="h-1.5 w-full rounded-full" style="background: var(--surface-base);">
              <div 
                class="h-full rounded-full"
                :style="{
                  width: `${Math.min(100, (cat.tokens / (sdkContext.maxTokens || 1)) * 100)}%`,
                  background: getCategoryColor(cat.color)
                }"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Active Memory Files -->
      <div v-if="sdkContext.memoryFiles && sdkContext.memoryFiles.length > 0" class="space-y-3">
        <h4 class="text-[11px] font-bold uppercase tracking-wider" style="color: var(--text-tertiary);">Memory Files (Context)</h4>
        <div class="max-h-48 overflow-y-auto space-y-1.5 pr-1">
          <div 
            v-for="file in sdkContext.memoryFiles" 
            :key="file.path"
            class="flex items-center justify-between p-2 rounded-lg text-[11px]"
            style="background: var(--surface-raised);"
          >
            <span class="font-mono truncate mr-2 text-left" style="color: var(--text-secondary);" :title="file.path">
              {{ file.path.split(/[\\/]/).pop() }}
            </span>
            <span class="font-mono shrink-0" style="color: var(--text-tertiary);">{{ formatNumber(file.tokens) }} tokens</span>
          </div>
        </div>
      </div>

      <!-- Skills detail -->
      <div v-if="sdkContext.skills && sdkContext.skills.totalSkills > 0" class="space-y-3">
        <h4 class="text-[11px] font-bold uppercase tracking-wider" style="color: var(--text-tertiary);">Active Skills ({{ sdkContext.skills.includedSkills }}/{{ sdkContext.skills.totalSkills }})</h4>
        <div class="p-2.5 rounded-lg space-y-1 text-[11px]" style="background: var(--surface-raised);">
          <div class="flex justify-between">
            <span style="color: var(--text-secondary);">Skills Token Payload</span>
            <span class="font-mono" style="color: var(--text-primary);">{{ formatNumber(sdkContext.skills.tokens) }} tokens</span>
          </div>
        </div>
      </div>

      <!-- Model Config Info -->
      <div class="p-2.5 rounded-lg space-y-1 text-[11px]" style="background: var(--surface-raised); border: 1px solid var(--border-subtle);">
        <div class="flex justify-between">
          <span style="color: var(--text-tertiary);">Model ID</span>
          <span class="font-mono font-medium" style="color: var(--accent);">{{ sdkContext.model }}</span>
        </div>
        <div v-if="sdkContext.autoCompactThreshold" class="flex justify-between pt-1">
          <span style="color: var(--text-tertiary);">Auto-Compact Threshold</span>
          <span class="font-mono" style="color: var(--text-secondary);">{{ formatNumber(sdkContext.autoCompactThreshold) }} tokens</span>
        </div>
      </div>
    </div>

    <!-- Static Fallback if no SDK Context details -->
    <div v-else class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h4 class="text-[11px] font-bold uppercase tracking-wider" style="color: var(--text-tertiary);">Token Breakdown</h4>
        <UTooltip text="Input + Cache Write + Cache Read = Context Used" :popper="{ placement: 'left' }">
          <UIcon name="i-lucide-help-circle" class="size-3.5" style="color: var(--text-disabled);" />
        </UTooltip>
      </div>
      
      <div class="space-y-3">
        <div class="flex flex-wrap items-center justify-between p-2.5 rounded-lg gap-2" style="background: var(--surface-raised);">
          <div class="flex items-center gap-2 min-w-0">
            <div class="size-2 rounded-full shrink-0" style="background: #3b82f6;" />
            <span class="text-[12px] break-words" style="color: var(--text-primary);">Input</span>
          </div>
          <span class="text-[12px] font-mono" style="color: var(--text-secondary);">{{ formatNumber(metrics.tokens.input) }}</span>
        </div>

        <div class="flex flex-wrap items-center justify-between p-2.5 rounded-lg gap-2" style="background: var(--surface-raised);">
          <div class="flex items-center gap-2 min-w-0">
            <div class="size-2 rounded-full shrink-0" style="background: #f59e0b;" />
            <span class="text-[12px] break-words" style="color: var(--text-primary);">Cache Write</span>
          </div>
          <span class="text-[12px] font-mono" style="color: var(--text-secondary);">{{ formatNumber(metrics.tokens.cacheCreation || 0) }}</span>
        </div>

        <div class="flex flex-wrap items-center justify-between p-2.5 rounded-lg gap-2" style="background: var(--surface-raised);">
          <div class="flex items-center gap-2 min-w-0">
            <div class="size-2 rounded-full shrink-0" style="background: #8b5cf6;" />
            <span class="text-[12px] break-words" style="color: var(--text-primary);">Cache Read</span>
          </div>
          <span class="text-[12px] font-mono" style="color: var(--text-secondary);">{{ formatNumber(metrics.tokens.cached || 0) }}</span>
        </div>

        <div class="flex flex-wrap items-center justify-between p-2.5 rounded-lg border-t border-dashed mt-2 pt-3 gap-2" style="border-color: var(--border-subtle);">
          <div class="flex items-center gap-2 min-w-0">
            <div class="size-2 rounded-full shrink-0" style="background: #22c55e;" />
            <span class="text-[12px] break-words" style="color: var(--text-primary);">Output (Next turn)</span>
          </div>
          <span class="text-[12px] font-mono" style="color: var(--text-secondary);">{{ formatNumber(metrics.tokens.output) }}</span>
        </div>
      </div>

      <!-- Cost Section -->
      <div v-if="metrics.cost.total > 0" class="space-y-3">
        <h4 class="text-[11px] font-bold uppercase tracking-wider" style="color: var(--text-tertiary);">Session Cost</h4>
        <div class="flex items-center justify-between p-2.5 rounded-lg" style="background: var(--surface-raised);">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-dollar-sign" class="size-3.5" style="color: #22c55e;" />
            <span class="text-[12px]" style="color: var(--text-primary);">Total Cost</span>
          </div>
          <span class="text-[14px] font-mono font-semibold" style="color: #22c55e;">${{ metrics.cost.total.toFixed(4) }}</span>
        </div>
      </div>
    </div>

    <!-- Information Box -->
    <div class="p-3 rounded-xl border space-y-2" style="background: rgba(229, 169, 62, 0.05); border-color: rgba(229, 169, 62, 0.15);">
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-info" class="size-3.5" style="color: var(--accent);" />
        <span class="text-[11px] font-bold" style="color: var(--accent);">About Context Window</span>
      </div>
      <p class="text-[11px] leading-relaxed" style="color: var(--text-secondary);">
        The context window includes all messages, files, and tool results currently visible to Claude. When this fills up, Claude may forget older parts of the conversation. And might need to compact the context window.
      </p>
    </div>
  </div>
</template>
