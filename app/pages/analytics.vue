<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const { t } = useI18n()
const loading = ref(true)
const error = ref<string | null>(null)

interface Summary {
  totalCost: number
  inputTokens: number
  outputTokens: number
  cachedTokens: number
  cachedSavingsRatio: number
  totalSessions: number
}

interface ModelUsage {
  model: string
  tokens: {
    input: number
    output: number
    cached: number
  }
  cost: number
  calls: number
}

interface SessionRecord {
  id: string
  type: 'chat' | 'cli'
  agentSlug?: string
  cost: number
  tokens: {
    input: number
    output: number
    cached: number
  }
  timestamp: string
}

interface HistoryPoint {
  date: string
  input: number
  output: number
  cached: number
  cost: number
}

interface AnalyticsData {
  summary: Summary
  byModel: ModelUsage[]
  history: HistoryPoint[]
  expensiveSessions: SessionRecord[]
}

const data = ref<AnalyticsData | null>(null)

// Chart Interaction State
const activePointIdx = ref<number | null>(null)
const chartContainer = ref<HTMLDivElement | null>(null)

async function fetchAnalytics() {
  loading.value = true
  error.value = null
  try {
    const res = await $fetch<AnalyticsData>('/api/analytics')
    data.value = res
  } catch (err: any) {
    error.value = err.message || 'Failed to load analytics data'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchAnalytics()
})

// Formatting Helpers
function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + 'M'
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + 'K'
  }
  return num.toString()
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// SVG Chart Plotting Computed Values
const chartWidth = 720
const chartHeight = 240
const chartPadding = { top: 20, right: 20, bottom: 30, left: 50 }

const chartPathData = computed(() => {
  if (!data.value || !data.value.history.length) return { line: '', area: '', points: [] }
  const points = data.value.history
  
  const minCost = 0
  const maxCost = Math.max(...points.map(p => p.cost), 0.1) * 1.1
  
  const xScaleWidth = chartWidth - chartPadding.left - chartPadding.right
  const yScaleHeight = chartHeight - chartPadding.top - chartPadding.bottom
  
  const stepX = xScaleWidth / (points.length - 1)
  
  const coordinates = points.map((p, idx) => {
    const x = chartPadding.left + idx * stepX
    const y = chartPadding.top + yScaleHeight - ((p.cost - minCost) / (maxCost - minCost)) * yScaleHeight
    return { x, y, point: p }
  })
  
  // Build Line Path (cubic bezier transition or straight line)
  let linePath = ''
  coordinates.forEach((c, idx) => {
    if (idx === 0) {
      linePath += `M ${c.x} ${c.y}`
    } else {
      // Quadratic bezier curve matching style
      const prev = coordinates[idx - 1]!
      const cpX1 = prev.x + stepX / 2
      const cpY1 = prev.y
      const cpX2 = prev.x + stepX / 2
      const cpY2 = c.y
      linePath += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${c.x} ${c.y}`
    }
  })
  
  // Build Filled Area Path
  const first = coordinates[0]!
  const last = coordinates[coordinates.length - 1]!
  const zeroY = chartHeight - chartPadding.bottom
  const areaPath = `${linePath} L ${last.x} ${zeroY} L ${first.x} ${zeroY} Z`
  
  return {
    line: linePath,
    area: areaPath,
    points: coordinates
  }
})

// Selected tooltip coordinate point details
const activePoint = computed(() => {
  if (activePointIdx.value === null || !chartPathData.value.points.length) return null
  return chartPathData.value.points[activePointIdx.value] || null
})

function handleMouseMove(e: MouseEvent) {
  if (!chartContainer.value || !chartPathData.value.points.length) return
  const rect = chartContainer.value.getBoundingClientRect()
  const mouseX = e.clientX - rect.left
  
  // Find the closest point index by horizontal coordinate
  let closestIdx = 0
  let minDiff = Infinity
  
  chartPathData.value.points.forEach((coord, idx) => {
    // scale coordinates based on rendered SVG width ratio
    const svgRatio = rect.width / chartWidth
    const scaledX = coord.x * svgRatio
    const diff = Math.abs(mouseX - scaledX)
    if (diff < minDiff) {
      minDiff = diff
      closestIdx = idx
    }
  })
  
  activePointIdx.value = closestIdx
}

function handleMouseLeave() {
  activePointIdx.value = null
}
</script>

<template>
  <div class="flex-1 flex flex-col overflow-y-auto">
    <PageHeader :title="t('nav.analytics')">
      <template #trailing>
        <span class="font-mono text-[12px] text-meta">Tokens & Spend</span>
      </template>
      <template #right>
        <UButton
          label="Refresh"
          icon="i-lucide-refresh-cw"
          size="sm"
          variant="outline"
          :loading="loading"
          @click="fetchAnalytics"
        />
      </template>
    </PageHeader>

    <div class="px-6 py-6 flex-1 space-y-6">
      <div v-if="loading" class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SkeletonCard v-for="i in 4" :key="i" class="h-24" />
      </div>

      <div v-else-if="error" class="card p-6 border-red-500/20 bg-red-500/5">
        <div class="flex items-center gap-3">
          <UIcon name="i-lucide-alert-triangle" class="size-5 text-red-500" />
          <span class="text-[13px] text-red-400 font-medium">{{ error }}</span>
        </div>
      </div>

      <div v-else-if="data" class="space-y-6">
        <!-- Metrics Row -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="card p-4 flex flex-col justify-between hover-card">
            <span class="text-[11px] font-mono text-meta uppercase tracking-wider">Estimated Spend</span>
            <div class="flex items-baseline gap-1 mt-2">
              <span class="text-2xl font-bold tracking-tight">${{ data.summary.totalCost.toFixed(2) }}</span>
              <span class="text-[11px] font-mono text-meta">USD</span>
            </div>
            <span class="text-[11px] text-emerald-400 font-mono mt-1">Active local rate</span>
          </div>

          <div class="card p-4 flex flex-col justify-between hover-card">
            <span class="text-[11px] font-mono text-meta uppercase tracking-wider">Total Tokens</span>
            <div class="flex items-baseline gap-1 mt-2">
              <span class="text-2xl font-bold tracking-tight">{{ formatNumber(data.summary.inputTokens + data.summary.outputTokens) }}</span>
              <span class="text-[11px] font-mono text-meta">total</span>
            </div>
            <span class="text-[11px] text-label font-mono mt-1">
              In: {{ formatNumber(data.summary.inputTokens) }} / Out: {{ formatNumber(data.summary.outputTokens) }}
            </span>
          </div>

          <div class="card p-4 flex flex-col justify-between hover-card">
            <span class="text-[11px] font-mono text-meta uppercase tracking-wider">Cache Efficiency</span>
            <div class="flex items-baseline gap-1 mt-2">
              <span class="text-2xl font-bold tracking-tight">{{ data.summary.cachedSavingsRatio }}%</span>
              <span class="text-[11px] font-mono text-meta">read</span>
            </div>
            <span class="text-[11px] text-meta font-mono mt-1">
              {{ formatNumber(data.summary.cachedTokens) }} tokens read from cache
            </span>
          </div>

          <div class="card p-4 flex flex-col justify-between hover-card">
            <span class="text-[11px] font-mono text-meta uppercase tracking-wider">Sessions Monitored</span>
            <div class="flex items-baseline gap-1 mt-2">
              <span class="text-2xl font-bold tracking-tight">{{ data.summary.totalSessions }}</span>
              <span class="text-[11px] font-mono text-meta">executions</span>
            </div>
            <span class="text-[11px] text-label font-mono mt-1">Chat & Terminal runs</span>
          </div>
        </div>

        <!-- Charts Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Area Chart -->
          <div class="card p-5 lg:col-span-2 space-y-4 hover-card">
            <div class="flex items-center justify-between">
              <div>
                <h4 class="text-[13px] font-semibold">Spend History Trend</h4>
                <p class="text-[11px] text-meta font-mono">14-Day daily cost rollup</p>
              </div>
              <div v-if="activePoint" class="text-right">
                <span class="text-[11px] font-mono font-medium text-emerald-400">${{ activePoint.point.cost.toFixed(4) }}</span>
                <span class="text-[10px] text-meta font-mono block">{{ formatDate(activePoint.point.date) }}</span>
              </div>
              <div v-else class="text-right">
                <span class="text-[11px] font-mono text-meta">Hover chart to inspect details</span>
              </div>
            </div>

            <!-- SVG Chart Area -->
            <div 
              ref="chartContainer" 
              class="relative aspect-[3/1] w-full select-none cursor-crosshair"
              @mousemove="handleMouseMove"
              @mouseleave="handleMouseLeave"
            >
              <svg 
                class="w-full h-full"
                :viewBox="`0 0 ${chartWidth} ${chartHeight}`" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <!-- Gradients -->
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.15" />
                    <stop offset="100%" stop-color="var(--accent)" stop-opacity="0.00" />
                  </linearGradient>
                </defs>

                <!-- Gridlines -->
                <line 
                  :x1="chartPadding.left" 
                  :y1="chartPadding.top" 
                  :x2="chartWidth - chartPadding.right" 
                  :y2="chartPadding.top" 
                  stroke="var(--border-subtle)" 
                  stroke-dasharray="3 3"
                />
                <line 
                  :x1="chartPadding.left" 
                  :y1="(chartHeight - chartPadding.top - chartPadding.bottom)/2 + chartPadding.top" 
                  :x2="chartWidth - chartPadding.right" 
                  :y2="(chartHeight - chartPadding.top - chartPadding.bottom)/2 + chartPadding.top" 
                  stroke="var(--border-subtle)" 
                  stroke-dasharray="3 3"
                />
                <line 
                  :x1="chartPadding.left" 
                  :y1="chartHeight - chartPadding.bottom" 
                  :x2="chartWidth - chartPadding.right" 
                  :y2="chartHeight - chartPadding.bottom" 
                  stroke="var(--border)"
                />

                <!-- Filled Area -->
                <path 
                  v-if="chartPathData.area"
                  :d="chartPathData.area" 
                  fill="url(#areaGradient)"
                />

                <!-- Line Path -->
                <path 
                  v-if="chartPathData.line"
                  :d="chartPathData.line" 
                  stroke="var(--accent)" 
                  stroke-width="2" 
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />

                <!-- Hover vertical helper line -->
                <line 
                  v-if="activePoint"
                  :x1="activePoint.x"
                  :y1="chartPadding.top"
                  :x2="activePoint.x"
                  :y2="chartHeight - chartPadding.bottom"
                  stroke="var(--accent)"
                  stroke-opacity="0.3"
                  stroke-width="1.5"
                  stroke-dasharray="2 2"
                />

                <!-- Coordinate circle handles -->
                <circle 
                  v-if="activePoint"
                  :cx="activePoint.x" 
                  :cy="activePoint.y" 
                  r="5" 
                  fill="var(--accent)" 
                  stroke="var(--card-bg)" 
                  stroke-width="2"
                />
                
                <!-- Y-Axis Labels -->
                <text 
                  :x="chartPadding.left - 10" 
                  :y="chartPadding.top + 4" 
                  text-anchor="end" 
                  fill="var(--meta)" 
                  class="font-mono text-[9px]"
                >
                  ${{ Math.max(...data.history.map(p => p.cost), 0.1).toFixed(2) }}
                </text>
                <text 
                  :x="chartPadding.left - 10" 
                  :y="(chartHeight - chartPadding.top - chartPadding.bottom)/2 + chartPadding.top + 4" 
                  text-anchor="end" 
                  fill="var(--meta)" 
                  class="font-mono text-[9px]"
                >
                  ${{ (Math.max(...data.history.map(p => p.cost), 0.1)/2).toFixed(2) }}
                </text>
                <text 
                  :x="chartPadding.left - 10" 
                  :y="chartHeight - chartPadding.bottom + 4" 
                  text-anchor="end" 
                  fill="var(--meta)" 
                  class="font-mono text-[9px]"
                >
                  $0.00
                </text>

                <!-- X-Axis Labels (Date sampling) -->
                <g v-if="data.history.length > 0">
                  <text 
                    :x="chartPadding.left" 
                    :y="chartHeight - chartPadding.bottom + 18" 
                    fill="var(--meta)" 
                    class="font-mono text-[9px]"
                  >
                    {{ formatDate(data.history[0]!.date) }}
                  </text>
                  <text 
                    :x="chartPadding.left + (chartWidth - chartPadding.left - chartPadding.right)/2" 
                    :y="chartHeight - chartPadding.bottom + 18" 
                    text-anchor="middle"
                    fill="var(--meta)" 
                    class="font-mono text-[9px]"
                  >
                    {{ formatDate(data.history[Math.floor(data.history.length / 2)]!.date) }}
                  </text>
                  <text 
                    :x="chartWidth - chartPadding.right" 
                    :y="chartHeight - chartPadding.bottom + 18" 
                    text-anchor="end"
                    fill="var(--meta)" 
                    class="font-mono text-[9px]"
                  >
                    {{ formatDate(data.history[data.history.length - 1]!.date) }}
                  </text>
                </g>
              </svg>
            </div>
          </div>

          <!-- Model Allocations -->
          <div class="card p-5 space-y-4 hover-card">
            <h4 class="text-[13px] font-semibold">Model Allocations</h4>
            <div class="space-y-4">
              <div v-for="model in data.byModel" :key="model.model" class="space-y-2">
                <div class="flex items-center justify-between text-[12px] font-mono">
                  <span class="font-medium text-body">{{ model.model }}</span>
                  <span class="font-semibold">${{ model.cost.toFixed(2) }}</span>
                </div>
                
                <!-- Micro-Bar -->
                <div class="w-full h-1.5 rounded-full overflow-hidden bg-muted">
                  <div 
                    class="h-full bg-accent"
                    :style="`width: ${data.summary.totalCost > 0 ? (model.cost / data.summary.totalCost) * 100 : 0}%`"
                  />
                </div>

                <div class="flex items-center justify-between text-[10px] text-meta font-mono">
                  <span>{{ formatNumber(model.tokens.input + model.tokens.output) }} tokens</span>
                  <span>{{ model.calls }} runs</span>
                </div>
              </div>

              <!-- Fallback message if no model breakdown -->
              <div v-if="data.byModel.length === 0" class="text-center py-6">
                <span class="text-[12px] text-meta">No breakdown available</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Expensive Sessions Table -->
        <div class="card p-5 space-y-4 hover-card">
          <h4 class="text-[13px] font-semibold">Most Cost-Intensive Execution Runs</h4>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-[12px] font-mono">
              <thead>
                <tr class="border-b" style="border-color: var(--border-subtle);">
                  <th class="pb-2 text-meta font-medium">Session ID</th>
                  <th class="pb-2 text-meta font-medium">Type</th>
                  <th class="pb-2 text-meta font-medium">Agent/Command</th>
                  <th class="pb-2 text-meta font-medium text-right">Tokens (In / Out / Cache)</th>
                  <th class="pb-2 text-meta font-medium text-right">Cost</th>
                  <th class="pb-2 text-meta font-medium text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-subtle" style="--tw-divide-opacity: 0.1;">
                <tr v-for="session in data.expensiveSessions" :key="session.id" class="hover-row">
                  <td class="py-2.5 font-medium truncate max-w-[120px]">{{ session.id }}</td>
                  <td class="py-2.5">
                    <span 
                      class="px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                      :class="session.type === 'cli' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'"
                    >
                      {{ session.type.toUpperCase() }}
                    </span>
                  </td>
                  <td class="py-2.5">
                    <span v-if="session.agentSlug" class="text-body font-semibold">/{{ session.agentSlug }}</span>
                    <span v-else class="text-meta">Custom Run</span>
                  </td>
                  <td class="py-2.5 text-right text-label">
                    {{ formatNumber(session.tokens.input) }} / {{ formatNumber(session.tokens.output) }} / {{ formatNumber(session.tokens.cached) }}
                  </td>
                  <td class="py-2.5 text-right text-emerald-400 font-semibold">${{ session.cost.toFixed(3) }}</td>
                  <td class="py-2.5 text-right text-meta">{{ formatDate(session.timestamp) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
