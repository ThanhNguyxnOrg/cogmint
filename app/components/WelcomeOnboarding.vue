<script setup lang="ts">
import type { Agent } from '~/types'
import { agentTemplates } from '~/utils/templates'
import { getAgentColor } from '~/utils/colors'

const emit = defineEmits<{
  created: [agent: Agent]
}>()

const { create } = useAgents()
const toast = useToast()
const creating = ref<string | null>(null)

async function useTemplate(templateId: string) {
  const template = agentTemplates.find(t => t.id === templateId)
  if (!template) return

  creating.value = templateId
  try {
    const agent = await create({
      frontmatter: { ...template.frontmatter },
      body: template.body,
    })
    toast.add({ title: `${template.frontmatter.name} created`, color: 'success' })
    emit('created', agent)
  } catch (e: any) {
    toast.add({ title: 'Failed to create agent', description: e.data?.message || e.message, color: 'error' })
  } finally {
    creating.value = null
  }
}
</script>

<template>
  <div class="space-y-8 max-w-4xl mx-auto py-4">
    <!-- Hero (Clean, minimalist layout) -->
    <div class="text-center space-y-3 pt-4">
      <h2 class="text-[26px] font-bold tracking-tight text-primary" style="font-family: var(--font-display); letter-spacing: -0.03em;">
        Welcome to Agent Manager
      </h2>
      <p class="text-[13px] text-secondary max-w-lg mx-auto leading-relaxed">
        This workspace helps you configure how Claude Code behaves. Create specialized <strong class="text-primary font-medium">agents</strong> with custom instructions, build reusable <strong class="text-primary font-medium">commands</strong>, and organize <strong class="text-primary font-medium">skills</strong> — all locally.
      </p>
    </div>

    <!-- Redesigned Concept blocks: Integrated Grid Panel -->
    <div class="rounded-xl border border-subtle bg-card overflow-hidden">
      <div class="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-subtle">
        <div class="p-5 space-y-2">
          <div class="flex items-center gap-2">
            <div class="size-6 rounded-md flex items-center justify-center bg-accent-muted border border-accent-glow">
              <UIcon name="i-lucide-cpu" class="size-3.5" style="color: var(--accent);" />
            </div>
            <span class="text-[13px] font-semibold text-primary">Agents</span>
          </div>
          <p class="text-[12px] text-label leading-relaxed">
            Specialized assistants. Each agent runs custom instructions, configuration files, and model tiers. Think of them as dedicated team roles.
          </p>
        </div>

        <div class="p-5 space-y-2">
          <div class="flex items-center gap-2">
            <div class="size-6 rounded-md flex items-center justify-center bg-accent-muted border border-accent-glow">
              <UIcon name="i-lucide-terminal" class="size-3.5" style="color: var(--accent);" />
            </div>
            <span class="text-[13px] font-semibold text-primary">Commands</span>
          </div>
          <p class="text-[12px] text-label leading-relaxed">
            Reusable workflows triggered with a slash key (e.g. /deploy). Keyboard shortcuts for repetitive dev operations.
          </p>
        </div>

        <div class="p-5 space-y-2">
          <div class="flex items-center gap-2">
            <div class="size-6 rounded-md flex items-center justify-center bg-accent-muted border border-accent-glow">
              <UIcon name="i-lucide-sparkles" class="size-3.5" style="color: var(--accent);" />
            </div>
            <span class="text-[13px] font-semibold text-primary">Skills</span>
          </div>
          <p class="text-[12px] text-label leading-relaxed">
            Local capabilities injected directly into agents. Teach them how to format files, query APIs, or write documentation.
          </p>
        </div>
      </div>
    </div>

    <!-- Quick start templates -->
    <div class="space-y-4">
      <div class="flex items-center justify-between border-b border-subtle pb-2">
        <span class="text-[13px] font-semibold tracking-tight text-primary">
          Quick Start — Pick a Template
        </span>
        <span class="text-[11px] text-meta">3 configurations ready</span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <button
          v-for="template in agentTemplates"
          :key="template.id"
          class="rounded-xl p-5 text-left focus-ring relative overflow-hidden group bg-card hover-card border border-subtle"
          :disabled="creating !== null"
          @click="useTemplate(template.id)"
        >
          <!-- Hover glow using agent color seed -->
          <div
            class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
            :style="{ background: 'radial-gradient(ellipse at top, ' + getAgentColor(template.frontmatter.color) + '08 0%, transparent 60%)' }"
          />

          <div class="flex items-center justify-between mb-3 relative">
            <div class="flex items-center gap-2.5">
              <div
                class="size-6 rounded-md flex items-center justify-center text-meta transition-colors"
                :style="{ background: getAgentColor(template.frontmatter.color) + '12' }"
              >
                <UIcon :name="template.icon" class="size-3.5" :style="{ color: getAgentColor(template.frontmatter.color) }" />
              </div>
              <span class="text-[13px] font-semibold text-primary group-hover:text-[var(--accent)] transition-colors">
                {{ template.frontmatter.name }}
              </span>
            </div>
            
            <UIcon
              v-if="creating === template.id"
              name="i-lucide-loader-2"
              class="size-3.5 animate-spin text-meta"
            />
            <div
              v-else
              class="size-1.5 rounded-full shrink-0"
              :style="{ background: getAgentColor(template.frontmatter.color) }"
            />
          </div>
          
          <p class="text-[12px] text-label leading-relaxed line-clamp-2 relative">
            {{ template.frontmatter.description }}
          </p>
        </button>
      </div>
      
      <p class="text-[11px] text-meta text-center leading-relaxed">
        Click any template to create it instantly. You can customize instructions and configurations afterward.
      </p>
    </div>
  </div>
</template>
