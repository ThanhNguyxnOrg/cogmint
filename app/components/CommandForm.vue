<script setup lang="ts">
import type { Command, CommandFrontmatter } from '~/types'

const emit = defineEmits<{
  saved: [command: Command]
  cancel: []
}>()

const { create, commands } = useCommands()
const toast = useToast()
const saving = ref(false)
const submitted = ref(false)

const frontmatter = ref<CommandFrontmatter>({
  name: '',
  description: '',
  'argument-hint': '',
})
const body = ref('')
const directory = ref('')
const allowedToolsStr = ref('')

// Template Selector State
const templateSelected = ref('empty')
const templates = {
  empty: '',
  review: `# Objective\nReview the codebase for the specified argument. Focus on code structure, styling, and design consistency.\n\n# Guidelines\n- Run tests if relevant.\n- Suggest refactor options if needed.`,
  exec: `# Objective\nRun the command with the specified arguments.\n\n# Execution\nRun the following script:\n\`\`\`bash\nnpm run build -- [argument]\n\`\`\``
}

watch(templateSelected, (newVal) => {
  const val = templates[newVal as keyof typeof templates]
  if (val !== undefined) {
    body.value = val
  }
})

const existingDirs = computed(() => {
  const dirs = new Set<string>()
  for (const cmd of commands.value) {
    if (cmd.directory) dirs.add(cmd.directory)
  }
  return Array.from(dirs).sort()
})

const errors = computed(() => {
  const e: Record<string, string> = {}
  if (!frontmatter.value.name.trim()) e.name = 'Name is required'
  else if (!/^[a-z0-9][a-z0-9-]*$/.test(frontmatter.value.name.trim()))
    e.name = 'Names can only contain lowercase letters, numbers, and hyphens (e.g., deploy-app)'
  if (!frontmatter.value.description.trim()) e.description = 'Description is required'
  return e
})

const isValid = computed(() => Object.keys(errors.value).length === 0)

function fieldError(field: string) {
  return submitted.value ? errors.value[field] : undefined
}

async function save() {
  submitted.value = true
  if (!isValid.value) return

  saving.value = true
  try {
    const tools = allowedToolsStr.value
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
    const command = await create({
      frontmatter: {
        ...frontmatter.value,
        'argument-hint': frontmatter.value['argument-hint']?.trim() || undefined,
        'allowed-tools': tools.length > 0 ? tools : undefined,
      },
      body: body.value,
      directory: directory.value || undefined,
    })
    toast.add({ title: 'Command created', color: 'success' })
    emit('saved', command)
  } catch (e: any) {
    toast.add({ title: 'Failed to create', description: e.data?.message || e.message, color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="p-6 space-y-4 bg-overlay">
    <h3 class="text-page-title">New Command</h3>
    <p class="text-[12px] leading-relaxed text-label">
      Commands are reusable workflows you can trigger with a slash command (e.g., /deploy).
    </p>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div class="field-group">
        <label class="field-label" data-required>Name</label>
        <input
          v-model="frontmatter.name"
          class="field-input"
          :class="{ 'field-input--error': fieldError('name') }"
          placeholder="my-command"
        />
        <span v-if="fieldError('name')" class="field-error">{{ fieldError('name') }}</span>
        <span v-else class="field-hint">e.g. gsd:my-command</span>
      </div>

      <div class="field-group">
        <label class="field-label">Directory</label>
        <input v-model="directory" class="field-input" placeholder="gsd" :list="existingDirs.length > 0 ? 'dirs-list' : undefined" />
        <datalist v-if="existingDirs.length > 0" id="dirs-list">
          <option v-for="d in existingDirs" :key="d" :value="d" />
        </datalist>
        <span class="field-hint">Subdirectory inside commands/</span>
      </div>
    </div>

    <div class="field-group">
      <label class="field-label" data-required>Description</label>
      <textarea
        v-model="frontmatter.description"
        rows="4"
        class="field-textarea"
        :class="{ 'field-input--error': fieldError('description') }"
        placeholder="What this command does..."
      />
      <span v-if="fieldError('description')" class="field-error">{{ fieldError('description') }}</span>
    </div>

    <div class="field-group">
      <label class="field-label">Tool Permissions</label>
      <input v-model="allowedToolsStr" class="field-input" placeholder="Read, Write, Bash" />
      <span class="field-hint">What Claude can do when running this command. Leave blank to allow all. Options: Read (read files), Write (create/edit files), Bash (run terminal commands)</span>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div class="field-group">
        <label class="field-label">Argument Hint</label>
        <input v-model="frontmatter['argument-hint']" class="field-input" placeholder="&lt;project-path&gt;" />
        <span class="field-hint">e.g. &lt;project-path&gt; or [branch]</span>
      </div>

      <div class="field-group">
        <label class="field-label">Instruction Template</label>
        <select v-model="templateSelected" class="field-input" style="background: var(--surface-base); border: 1px solid var(--border); color: var(--text-primary);">
          <option value="empty">Empty / Custom Instructions</option>
          <option value="review">Codebase Review & Audit</option>
          <option value="exec">Script Execution</option>
        </select>
        <span class="field-hint">Prefills objective and execution layout</span>
      </div>
    </div>

    <div class="field-group">
      <label class="field-label">Instructions</label>
      <textarea
        v-model="body"
        class="editor-textarea editor-textarea--standalone"
        spellcheck="false"
        placeholder="<objective>..."
      />
    </div>

    <div class="flex justify-end gap-2 pt-2">
      <UButton label="Cancel" variant="ghost" color="neutral" size="sm" @click="emit('cancel')" />
      <UButton label="Create" size="sm" :loading="saving" @click="save" />
    </div>
  </div>
</template>
