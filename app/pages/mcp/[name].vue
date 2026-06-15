<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
const { t } = useI18n()

const route = useRoute()
const router = useRouter()
const { fetchServer, addServer, removeServer } = useMCP()
const { clearChat: clearStudioChat, toolCalls, isStreaming: studioStreaming } = useStudioChat()
const { workingDir } = useWorkingDir()
const toast = useToast()

const name = route.params.name as string
const scope = route.query.scope as 'global' | 'project'

const loading = ref(true)
const saving = ref(false)
const showDeleteConfirm = ref(false)

const form = ref({
  name: '',
  transport: 'stdio' as 'stdio' | 'sse',
  command: '',
  argsString: '',
  url: '',
  scope: 'global' as 'global' | 'project',
  disabled: false,
  envPairs: [] as { key: string; value: string }[],
  headerPairs: [] as { key: string; value: string }[]
})

const initialForm = ref('')

const isDirty = computed(() => {
  return JSON.stringify(form.value) !== initialForm.value
})

const isTrusted = ref(true)
const hasProjectConfig = ref(false)
const checkingTrust = ref(false)

// GUI Tester State
const activeTab = ref<'tester' | 'chat'>('tester')
const tools = ref<any[]>([])
const selectedToolName = ref('')
const toolsLoading = ref(false)
const toolsError = ref<string | null>(null)
const toolArguments = ref<Record<string, any>>({})
const executionResult = ref<any>(null)
const executingTool = ref(false)
const executionError = ref<string | null>(null)

const selectedTool = computed(() => tools.value.find(t => t.name === selectedToolName.value))

function selectTool(toolName: string) {
  selectedToolName.value = toolName
  toolArguments.value = {}
  executionResult.value = null
  executionError.value = null
  
  const schema = selectedTool.value?.inputSchema
  if (schema && schema.properties) {
    for (const [key, prop] of Object.entries<any>(schema.properties)) {
      if (prop.default !== undefined) {
        toolArguments.value[key] = prop.default
      } else if (prop.type === 'boolean') {
        toolArguments.value[key] = false
      } else {
        toolArguments.value[key] = ''
      }
    }
  }
}

async function checkWorkspaceTrust() {
  if (scope !== 'project' || !workingDir.value) {
    isTrusted.value = true
    hasProjectConfig.value = false
    return
  }
  checkingTrust.value = true
  try {
    const res = await $fetch<{ trusted: boolean; hasProjectConfig: boolean }>('/api/mcp/trust', {
      query: { workingDir: workingDir.value }
    })
    isTrusted.value = res.trusted
    hasProjectConfig.value = res.hasProjectConfig
  } catch {
    isTrusted.value = true
    hasProjectConfig.value = false
  } finally {
    checkingTrust.value = false
  }
}

async function trustWorkspace() {
  if (!workingDir.value) return
  try {
    await $fetch('/api/mcp/trust', {
      method: 'POST',
      body: { workingDir: workingDir.value, trust: true }
    })
    isTrusted.value = true
    toast.add({ title: 'Workspace trusted successfully', color: 'success' })
    await loadServerDetails()
  } catch (err: any) {
    toast.add({ title: 'Failed to trust workspace', description: err.message, color: 'error' })
  }
}

async function loadTools() {
  if (scope === 'project' && !isTrusted.value) {
    tools.value = []
    return
  }
  toolsLoading.value = true
  toolsError.value = null
  try {
    const res = await $fetch<{ tools: any[] }>('/api/mcp/tools', {
      query: { name, scope, workingDir: workingDir.value }
    })
    tools.value = res.tools || []
    if (tools.value.length > 0) {
      selectTool(tools.value[0].name)
    }
  } catch (err: any) {
    toolsError.value = err.message || 'Failed to load tools'
  } finally {
    toolsLoading.value = false
  }
}

async function loadServerDetails() {
  try {
    await checkWorkspaceTrust()
    const data = await fetchServer(name, scope)
    form.value.name = data.name
    form.value.transport = data.transport
    form.value.command = data.command || ''
    form.value.argsString = data.args?.join(' ') || ''
    form.value.url = data.url || ''
    form.value.scope = data.scope
    form.value.disabled = !!data.disabled
    
    if (data.env) {
      form.value.envPairs = Object.entries(data.env).map(([key, value]) => ({ key, value }))
    }
    if (data.headers) {
      form.value.headerPairs = Object.entries(data.headers).map(([key, value]) => ({ key, value }))
    }
    initialForm.value = JSON.stringify(form.value)

    if (!form.value.disabled && form.value.transport === 'stdio') {
      await loadTools()
    }
  } catch (err) {
    router.push('/mcp')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadServerDetails()
  clearStudioChat()
})

async function runSelectedTool() {
  if (!selectedToolName.value) return
  executingTool.value = true
  executionResult.value = null
  executionError.value = null
  try {
    const payloadArgs: Record<string, any> = {}
    const schema = selectedTool.value?.inputSchema
    
    for (const [key, value] of Object.entries(toolArguments.value)) {
      const propSchema = schema?.properties?.[key]
      if (propSchema?.type === 'object' || propSchema?.type === 'array') {
        if (typeof value === 'string' && value.trim()) {
          try {
            payloadArgs[key] = JSON.parse(value)
          } catch (e) {
            throw new Error(`Invalid JSON format for parameter "${key}"`)
          }
        }
      } else if (propSchema?.type === 'number' || propSchema?.type === 'integer') {
        if (value !== '') {
          payloadArgs[key] = Number(value)
        }
      } else if (propSchema?.type === 'boolean') {
        payloadArgs[key] = !!value
      } else {
        if (value !== '') {
          payloadArgs[key] = value
        }
      }
    }

    const res = await $fetch<any>('/api/mcp/run', {
      method: 'POST',
      body: {
        name,
        scope,
        tool: selectedToolName.value,
        arguments: payloadArgs,
        workingDir: workingDir.value
      }
    })
    executionResult.value = res
  } catch (err: any) {
    executionError.value = err.message || 'Execution failed'
  } finally {
    executingTool.value = false
  }
}

function copyToClipboard(text: string) {
  if (import.meta.client && navigator.clipboard) {
    navigator.clipboard.writeText(text)
    toast.add({ title: 'Copied output to clipboard', color: 'success' })
  }
}

function addEnvRow() { form.value.envPairs.push({ key: '', value: '' }) }
function removeEnvRow(idx: number) { form.value.envPairs.splice(idx, 1) }

function addHeaderRow() { form.value.headerPairs.push({ key: '', value: '' }) }
function removeHeaderRow(idx: number) { form.value.headerPairs.splice(idx, 1) }

async function save() {
  if (!form.value.name.trim()) return
  saving.value = true
  
  const payload: any = {
    name: form.value.name.trim(),
    oldName: name,
    transport: form.value.transport,
    scope: form.value.scope,
    disabled: form.value.disabled
  }

  if (form.value.transport === 'stdio') {
    payload.command = form.value.command.trim()
    payload.args = form.value.argsString.split(' ').map(a => a.trim()).filter(a => a.length > 0)
    const env: Record<string, string> = {}
    for (const pair of form.value.envPairs) {
      if (pair.key.trim() && pair.value.trim()) env[pair.key.trim()] = pair.value.trim()
    }
    payload.env = env
  } else {
    payload.url = form.value.url.trim()
    const headers: Record<string, string> = {}
    for (const pair of form.value.headerPairs) {
      if (pair.key.trim() && pair.value.trim()) headers[pair.key.trim()] = pair.value.trim()
    }
    payload.headers = headers
  }

  try {
    await addServer(payload)
    initialForm.value = JSON.stringify(form.value)

    if (payload.name !== name) {
      router.push({ path: `/mcp/${encodeURIComponent(payload.name)}`, query: { scope: payload.scope } })
    } else {
      await loadTools()
    }
  } catch (e: any) {
    // Error is already handled/toasted by useMCP
  } finally {
    saving.value = false
  }
}

async function handleDelete() {
  try {
    await removeServer(name, scope)
    router.push('/mcp')
  } catch (e: any) {
    // Error is already handled/toasted by useMCP
  }
}

function handleKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault()
    if (isDirty.value && !saving.value) save()
  }
}
onMounted(() => document.addEventListener('keydown', handleKeydown))
onUnmounted(() => document.removeEventListener('keydown', handleKeydown))

useUnsavedChanges(isDirty)
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Top bar -->
    <div class="shrink-0 flex items-center justify-between px-6 py-3 border-b" style="border-color: var(--border-subtle);">
      <div class="flex items-center gap-3">
        <NuxtLink to="/mcp" class="p-1 rounded-md hover-bg" style="color: var(--text-tertiary);">
          <UIcon name="i-lucide-arrow-left" class="size-4" />
        </NuxtLink>
        <UIcon name="i-lucide-server" class="size-4" style="color: var(--accent);" />
        <h1 class="text-[16px] font-semibold tracking-tight" style="color: var(--text-primary); font-family: var(--font-display);">
          {{ loading ? t('common.loading') : name }}
        </h1>
        <span v-if="isDirty" class="text-[9px] font-mono px-1.5 py-px rounded-full" style="background: rgba(229, 169, 62, 0.1); color: var(--accent);">{{ t('common.unsaved') }}</span>
        <span v-if="!isTrusted && scope === 'project'" class="text-[9px] font-mono px-1.5 py-px rounded-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
          Untrusted Workspace
        </span>
      </div>
      <div class="flex items-center gap-2">
        <UButton
          :label="saving ? t('mcpDetail.saving') : t('mcpDetail.save')"
          icon="i-lucide-save"
          size="sm"
          :variant="isDirty ? 'solid' : 'soft'"
          :color="isDirty ? 'primary' : 'neutral'"
          :disabled="!isDirty || saving"
          :loading="saving"
          @click="save"
        />
        <UButton
          :label="t('common.delete')"
          icon="i-lucide-trash-2"
          size="sm"
          variant="ghost"
          color="error"
          :title="t('mcpDetail.deleteServer')"
          @click="showDeleteConfirm = true"
        />
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <UIcon name="i-lucide-loader-2" class="size-6 animate-spin" style="color: var(--text-disabled);" />
    </div>

    <!-- Main Content -->
    <div v-else class="flex-1 flex min-h-0">
      <!-- Left: Configuration -->
      <div class="w-[60%] flex flex-col border-r overflow-y-auto custom-scrollbar" style="border-color: var(--border-subtle);">
        <!-- Workspace Trust Details Alert -->
        <div v-if="!isTrusted" class="mx-8 mt-6 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5 flex items-start justify-between gap-4">
          <div class="flex gap-3 min-w-0">
            <UIcon name="i-lucide-shield-alert" class="size-5 text-yellow-500 shrink-0" />
            <div>
              <h4 class="text-[13px] font-semibold text-primary">Untrusted Workspace Config</h4>
              <p class="text-[12px] text-secondary leading-relaxed mt-0.5">
                This project-level server configuration cannot be listed or executed until you explicitly trust this directory.
              </p>
              <p class="text-[11px] text-meta font-mono mt-1 truncate">{{ workingDir }}</p>
            </div>
          </div>
          <UButton label="Trust" size="xs" color="warning" icon="i-lucide-shield-check" @click="trustWorkspace" />
        </div>

        <div class="px-8 py-6 space-y-8">
          <!-- Basic Info -->
          <section class="space-y-4">
            <h3 class="text-[13px] font-semibold tracking-wider uppercase opacity-50" style="color: var(--text-primary);">{{ t('mcpDetail.basicInfo') }}</h3>
            <div class="grid grid-cols-2 gap-6">
              <div class="space-y-1.5">
                <label class="text-[11px] font-medium" style="color: var(--text-tertiary);">{{ t('mcpDetail.serverName') }}</label>
                <input v-model="form.name" type="text" class="field-input w-full" />
              </div>
              <div class="space-y-1.5">
                <label class="text-[11px] font-medium" style="color: var(--text-tertiary);">{{ t('mcpDetail.scope') }}</label>
                <select v-model="form.scope" class="field-input w-full" disabled>
                  <option value="global">{{ t('mcpDetail.scopeGlobal') }}</option>
                  <option value="project">{{ t('mcpDetail.scopeProject') }}</option>
                </select>
                <p class="text-[10px] italic opacity-60" style="color: var(--text-tertiary);">{{ t('mcpDetail.scopeLocked') }}</p>
              </div>
            </div>
            <div class="flex items-center gap-2 pt-2">
              <label class="field-toggle">
                <input
                  type="checkbox"
                  :checked="!form.disabled"
                  @change="form.disabled = !($event.target as HTMLInputElement).checked"
                />
                <span class="field-toggle__track">
                  <span class="field-toggle__thumb" />
                </span>
              </label>
              <div class="flex flex-col">
                <span class="text-[13px] font-medium" :class="form.disabled ? 'text-secondary' : 'text-primary'">
                  {{ form.disabled ? t('mcpDetail.serverDisabled') : t('mcpDetail.serverEnabled') }}
                </span>
                <span class="text-[11px] text-tertiary opacity-60">
                  {{ form.disabled ? t('mcpDetail.disabledDesc') : t('mcpDetail.enabledDesc') }}
                </span>
              </div>
            </div>
          </section>

          <!-- Transport -->
          <section class="space-y-4">
            <h3 class="text-[13px] font-semibold tracking-wider uppercase opacity-50" style="color: var(--text-primary);">{{ t('mcpDetail.transport') }}</h3>
            <div class="space-y-4">
              <div class="space-y-1.5">
                <label class="text-[11px] font-medium" style="color: var(--text-tertiary);">{{ t('mcpDetail.transportType') }}</label>
                <div class="flex gap-6 pt-1">
                  <label class="flex items-center gap-2 cursor-pointer group">
                    <input v-model="form.transport" type="radio" value="stdio" class="accent-accent" />
                    <span class="text-[13px] group-hover:opacity-100 transition-opacity" :class="form.transport === 'stdio' ? 'opacity-100 font-medium' : 'opacity-60'">{{ t('mcpDetail.stdio') }}</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer group">
                    <input v-model="form.transport" type="radio" value="sse" class="accent-accent" />
                    <span class="text-[13px] group-hover:opacity-100 transition-opacity" :class="form.transport === 'sse' ? 'opacity-100 font-medium' : 'opacity-60'">{{ t('mcpDetail.sse') }}</span>
                  </label>
                </div>
              </div>

              <template v-if="form.transport === 'stdio'">
                <div class="space-y-4">
                  <div class="space-y-1.5">
                    <label class="text-[11px] font-medium" style="color: var(--text-tertiary);">{{ t('mcpDetail.command') }}</label>
                    <input v-model="form.command" type="text" class="field-input w-full font-mono text-[13px]" placeholder="e.g. npx" />
                  </div>
                  <div class="space-y-1.5">
                    <label class="text-[11px] font-medium" style="color: var(--text-tertiary);">{{ t('mcpDetail.arguments') }}</label>
                    <input v-model="form.argsString" type="text" class="field-input w-full font-mono text-[13px]" placeholder="e.g. -y @modelcontextprotocol/server-github" />
                  </div>
                </div>
              </template>

              <template v-else>
                <div class="space-y-1.5">
                  <label class="text-[11px] font-medium" style="color: var(--text-tertiary);">{{ t('mcpDetail.url') }}</label>
                  <input v-model="form.url" type="text" class="field-input w-full font-mono text-[13px]" placeholder="https://example.com/sse" />
                </div>
              </template>
            </div>
          </section>

          <!-- Dynamic Rows -->
          <section class="space-y-4">
            <div v-if="form.transport === 'stdio'">
              <div class="flex items-center justify-between mb-2">
                <h3 class="text-[13px] font-semibold tracking-wider uppercase opacity-50" style="color: var(--text-primary);">{{ t('mcpDetail.envVars') }}</h3>
                <button class="text-[11px] font-medium transition-colors" style="color: var(--accent);" @click="addEnvRow">
                  {{ t('mcpDetail.addEnvRow') }}
                </button>
              </div>
              <div class="space-y-2">
                <div v-for="(pair, idx) in form.envPairs" :key="idx" class="flex items-center gap-2 group">
                  <input v-model="pair.key" type="text" class="field-input flex-1 font-mono text-[12px]" placeholder="KEY" />
                  <span class="text-secondary opacity-40">=</span>
                  <input v-model="pair.value" type="text" class="field-input flex-1 font-mono text-[12px]" placeholder="VALUE" />
                  <button class="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-error/10 text-error/60 hover:text-error" @click="removeEnvRow(idx)">
                    <UIcon name="i-lucide-trash-2" class="size-3.5" />
                  </button>
                </div>
                <div v-if="!form.envPairs.length" class="py-4 border border-dashed rounded-xl flex flex-col items-center justify-center opacity-40" style="border-color: var(--border-subtle);">
                  <p class="text-[12px]">{{ t('mcpDetail.noEnvVars') }}</p>
                </div>
              </div>
            </div>

            <div v-else>
              <div class="flex items-center justify-between mb-2">
                <h3 class="text-[13px] font-semibold tracking-wider uppercase opacity-50" style="color: var(--text-primary);">{{ t('mcpDetail.headers') }}</h3>
                <button class="text-[11px] font-medium transition-colors" style="color: var(--accent);" @click="addHeaderRow">
                  {{ t('mcpDetail.addHeaderRow') }}
                </button>
              </div>
              <div class="space-y-2">
                <div v-for="(pair, idx) in form.headerPairs" :key="idx" class="flex items-center gap-2 group">
                  <input v-model="pair.key" type="text" class="field-input flex-1 font-mono text-[12px]" placeholder="Header Name" />
                  <span class="text-secondary opacity-40">:</span>
                  <input v-model="pair.value" type="text" class="field-input flex-1 font-mono text-[12px]" placeholder="Value" />
                  <button class="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-error/10 text-error/60 hover:text-error" @click="removeHeaderRow(idx)">
                    <UIcon name="i-lucide-trash-2" class="size-3.5" />
                  </button>
                </div>
                <div v-if="!form.headerPairs.length" class="py-4 border border-dashed rounded-xl flex flex-col items-center justify-center opacity-40" style="border-color: var(--border-subtle);">
                  <p class="text-[12px]">{{ t('mcpDetail.noHeaders') }}</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <!-- Right: Tabbed Test and GUI Tester -->
      <div class="w-[40%] flex flex-col border-l" style="border-color: var(--border-subtle);">
        <!-- Tab Selector -->
        <div class="shrink-0 flex border-b px-4 py-2 gap-2" style="border-color: var(--border-subtle); background: var(--surface-raised);">
          <button
            class="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all"
            :style="{
              background: activeTab === 'tester' ? 'rgba(229, 169, 62, 0.1)' : 'transparent',
              color: activeTab === 'tester' ? 'var(--accent)' : 'var(--text-tertiary)'
            }"
            @click="activeTab = 'tester'"
          >
            GUI Tool Tester
          </button>
          <button
            class="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all"
            :style="{
              background: activeTab === 'chat' ? 'rgba(229, 169, 62, 0.1)' : 'transparent',
              color: activeTab === 'chat' ? 'var(--accent)' : 'var(--text-tertiary)'
            }"
            @click="activeTab = 'chat'"
          >
            Interactive Chat
          </button>
        </div>

        <!-- Tab 1: GUI Tool Tester -->
        <div v-if="activeTab === 'tester'" class="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar p-6 space-y-6">
          <!-- Untrusted Workspace Alert -->
          <div v-if="!isTrusted" class="p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5 space-y-3">
            <div class="flex gap-2">
              <UIcon name="i-lucide-shield-alert" class="size-4 shrink-0 mt-0.5 text-yellow-500" />
              <div>
                <h4 class="text-[12px] font-semibold text-primary">Untrusted Workspace</h4>
                <p class="text-[11px] text-secondary leading-relaxed mt-0.5">
                  Direct tool execution and listing are disabled for safety until this project workspace directory is trusted.
                </p>
              </div>
            </div>
            <UButton label="Trust Workspace" size="xs" color="warning" block @click="trustWorkspace" />
          </div>

          <!-- Disabled Warning -->
          <div v-else-if="form.disabled" class="p-4 rounded-xl border border-subtle bg-surface-raised flex gap-3 text-secondary">
            <UIcon name="i-lucide-info" class="size-4 shrink-0 mt-0.5" />
            <p class="text-[12px] leading-relaxed">
              Enable the server to test its tools.
            </p>
          </div>

          <!-- SSE Warning -->
          <div v-else-if="form.transport !== 'stdio'" class="p-4 rounded-xl border border-subtle bg-surface-raised flex gap-3 text-secondary">
            <UIcon name="i-lucide-info" class="size-4 shrink-0 mt-0.5" />
            <p class="text-[12px] leading-relaxed">
              Direct GUI testing is currently supported for Stdio transport servers.
            </p>
          </div>

          <!-- Active Tools Selection -->
          <div v-else class="space-y-4">
            <div v-if="toolsLoading" class="flex items-center gap-2 text-secondary text-[12px] py-4">
              <UIcon name="i-lucide-loader-2" class="size-4 animate-spin text-accent" />
              <span>Querying available tools...</span>
            </div>

            <div v-else-if="toolsError" class="p-4 rounded-xl border border-error/20 bg-error/5 text-error text-[12px]">
              {{ toolsError }}
              <UButton label="Retry" size="xs" class="mt-2" variant="soft" color="error" @click="loadTools" />
            </div>

            <div v-else-if="tools.length === 0" class="py-8 text-center text-secondary text-[12px]">
              No tools exposed by this MCP server.
            </div>

            <div v-else class="space-y-4">
              <!-- Select Tool -->
              <div class="space-y-1.5">
                <label class="text-[11px] font-medium" style="color: var(--text-tertiary);">Select Tool</label>
                <select
                  :value="selectedToolName"
                  class="field-input w-full font-mono text-[12px]"
                  @change="selectTool(($event.target as HTMLSelectElement).value)"
                >
                  <option v-for="t in tools" :key="t.name" :value="t.name">{{ t.name }}</option>
                </select>
              </div>

              <!-- Tool Description -->
              <div v-if="selectedTool" class="p-3.5 rounded-xl border" style="border-color: var(--border-subtle); background: var(--surface-raised);">
                <h4 class="text-[12px] font-semibold text-primary font-mono">{{ selectedTool.name }}</h4>
                <p class="text-[11px] text-secondary leading-relaxed mt-1" v-if="selectedTool.description">
                  {{ selectedTool.description }}
                </p>
              </div>

              <!-- Tool Inputs Form -->
              <div v-if="selectedTool" class="space-y-4 pt-2">
                <h4 class="text-[11px] font-semibold tracking-wider uppercase opacity-50">Parameters</h4>
                
                <div v-if="!selectedTool.inputSchema?.properties || Object.keys(selectedTool.inputSchema.properties).length === 0" class="text-[12px] text-secondary italic">
                  This tool accepts no arguments.
                </div>

                <div v-else class="space-y-3">
                  <div
                    v-for="[key, prop] in Object.entries<any>(selectedTool.inputSchema.properties)"
                    :key="key"
                    class="space-y-1.5"
                  >
                    <div class="flex items-center justify-between text-[11px]">
                      <span class="font-semibold font-mono" style="color: var(--text-secondary);">
                        {{ key }}
                        <span v-if="selectedTool.inputSchema.required?.includes(key)" class="text-error font-sans ml-0.5">*</span>
                      </span>
                      <span class="text-[10px] opacity-65 font-mono" style="color: var(--text-disabled);">
                        {{ prop.type }}
                      </span>
                    </div>

                    <p v-if="prop.description" class="text-[10px] leading-relaxed italic" style="color: var(--text-disabled);">
                      {{ prop.description }}
                    </p>

                    <!-- Form Inputs based on type -->
                    <template v-if="prop.type === 'boolean'">
                      <label class="field-toggle scale-90 origin-left">
                        <input type="checkbox" v-model="toolArguments[key]" />
                        <span class="field-toggle__track">
                          <span class="field-toggle__thumb" />
                        </span>
                      </label>
                    </template>

                    <template v-else-if="prop.type === 'object' || prop.type === 'array'">
                      <textarea
                        v-model="toolArguments[key]"
                        class="field-input w-full font-mono text-[11px] min-h-[60px]"
                        placeholder='e.g. { "key": "value" }'
                        rows="3"
                      />
                    </template>

                    <template v-else-if="prop.type === 'number' || prop.type === 'integer'">
                      <input
                        type="number"
                        v-model="toolArguments[key]"
                        class="field-input w-full font-mono text-[12px]"
                      />
                    </template>

                    <template v-else>
                      <input
                        type="text"
                        v-model="toolArguments[key]"
                        class="field-input w-full font-mono text-[12px]"
                        placeholder="value..."
                      />
                    </template>
                  </div>
                </div>

                <!-- Submit Button -->
                <div class="pt-2">
                  <UButton
                    label="Run Tool"
                    icon="i-lucide-play"
                    block
                    color="primary"
                    :loading="executingTool"
                    @click="runSelectedTool"
                  />
                </div>

                <!-- Output Display -->
                <div v-if="executingTool || executionResult || executionError" class="space-y-2 pt-4 border-t" style="border-color: var(--border-subtle);">
                  <div class="flex items-center justify-between">
                    <span class="text-[11px] font-semibold tracking-wider uppercase opacity-50">Response</span>
                    <button
                      v-if="executionResult"
                      class="text-[10px] font-medium text-accent flex items-center gap-1 hover:underline bg-transparent border-0 cursor-pointer"
                      @click="copyToClipboard(JSON.stringify(executionResult, null, 2))"
                    >
                      <UIcon name="i-lucide-copy" class="size-3" />
                      Copy Output
                    </button>
                  </div>

                  <div v-if="executingTool" class="p-4 rounded-xl border border-dashed flex items-center justify-center text-[12px] text-secondary gap-2" style="border-color: var(--border-subtle);">
                    <UIcon name="i-lucide-loader-2" class="size-4 animate-spin text-accent" />
                    Executing tool on host...
                  </div>

                  <div v-else-if="executionError" class="p-4 rounded-xl border border-error/20 bg-error/5 text-error font-mono text-[11px] whitespace-pre-wrap">
                    {{ executionError }}
                  </div>

                  <div v-else-if="executionResult" class="p-4 rounded-xl border bg-surface-base font-mono text-[11px] max-h-[250px] overflow-y-auto custom-scrollbar whitespace-pre-wrap" style="border-color: var(--border-subtle); color: var(--text-primary);">
                    {{ JSON.stringify(executionResult, null, 2) }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab 2: Interactive Chat -->
        <div v-else-if="activeTab === 'chat'" class="flex-1 flex flex-col min-h-0">
          <div class="flex-1 min-h-0">
            <TestPanel :agent-slug="`mcp-${name}`" :agent-name="name" :is-draft="isDirty" />
          </div>
          <ExecutionInspector :tool-calls="toolCalls" :is-streaming="studioStreaming" />
        </div>
      </div>
    </div>

    <!-- Delete confirmation -->
    <Teleport to="body">
      <div v-if="showDeleteConfirm" class="fixed inset-0 z-50 flex items-center justify-center" style="background: rgba(0,0,0,0.4); backdrop-filter: blur(2px);">
        <div class="rounded-2xl p-6 max-w-sm w-full mx-4 space-y-4 shadow-xl" style="background: var(--surface-raised); border: 1px solid var(--border-subtle);">
          <h3 class="text-[15px] font-semibold" style="color: var(--text-primary);">{{ t('mcpDetail.deleteConfirm') }}</h3>
          <p class="text-[13px]" style="color: var(--text-secondary);">{{ t('mcpDetail.deleteConfirmText') }} <span class="font-mono font-bold">{{ name }}</span> {{ t('common.deleteConfirm') }}</p>
          <div class="flex gap-2 justify-end pt-2">
            <button class="px-3 py-1.5 rounded-lg text-[12px] font-medium hover-bg" style="color: var(--text-tertiary);" @click="showDeleteConfirm = false">{{ t('common.cancel') }}</button>
            <button class="px-3 py-1.5 rounded-lg text-[12px] font-medium" style="background: var(--error); color: white;" @click="handleDelete">{{ t('mcpDetail.deleteForever') }}</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.field-input {
  background: var(--surface-base);
  border: 1px solid var(--border-subtle);
  color: var(--text-primary);
  border-radius: 0.5rem;
  padding: 0.6rem 0.8rem;
  transition: all 0.2s ease;
}
.field-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(229, 169, 62, 0.1);
}
.field-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: var(--surface-raised);
}

.accent-accent { accent-color: var(--accent); }
.hover-bg:hover { background: var(--surface-raised); }

.custom-scrollbar::-webkit-scrollbar { width: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: var(--border-subtle); border-radius: 3px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--text-disabled); }
</style>
