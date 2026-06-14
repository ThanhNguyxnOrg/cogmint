<script setup lang="ts">
import { getAgentColor } from "~/utils/colors";
import { MODEL_IDS, getModelLabel, getModelColor, getModelBadgeClasses } from "~/utils/models";
const { t } = useI18n();

const { claudeDir, set: setDir } = useClaudeDir();
const { agents, fetchAll: fetchAgents } = useAgents();
const { commands, fetchAll: fetchCommands } = useCommands();
const { plugins, fetchAll: fetchPlugins } = usePlugins();
const { skills, fetchAll: fetchSkills } = useSkills();
const { skillImports, agentImports, fetchImports } = useGithubImports();
const { settings, load: loadSettings } = useSettings();

const dirInput = ref("");
const settingDir = ref(false);

interface Suggestion {
  type: string;
  severity: "warning" | "info";
  message: string;
  target: { type: "agent" | "command" | "skill"; slug: string };
}
const suggestions = ref<Suggestion[]>([]);

// Animated counters
const animatedCounts = reactive({
  agents: 0,
  commands: 0,
  skills: 0,
  plugins: 0,
});

function animateCounter(target: number, key: keyof typeof animatedCounts) {
  if (target === 0) {
    animatedCounts[key] = 0;
    return;
  }
  const duration = 600;
  const startTime = performance.now();
  function tick(now: number) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
    animatedCounts[key] = Math.round(eased * target);
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

onMounted(async () => {
  dirInput.value = claudeDir.value || "";
  await Promise.all([
    loadSettings(), 
    fetchPlugins(), 
    fetchSkills(), 
    fetchImports('skills'),
    fetchImports('agents')
  ]);

  // Animate counters after data loads
  nextTick(() => {
    animateCounter(agents.value.length, "agents");
    animateCounter(commands.value.length, "commands");
    animateCounter(skills.value.length, "skills");
    animateCounter(plugins.value.length, "plugins");
  });

  // Watch for data changes to re-animate
  watch(
    () => agents.value.length,
    (v) => animateCounter(v, "agents"),
  );
  watch(
    () => commands.value.length,
    (v) => animateCounter(v, "commands"),
  );
  watch(
    () => skills.value.length,
    (v) => animateCounter(v, "skills"),
  );
  watch(
    () => plugins.value.length,
    (v) => animateCounter(v, "plugins"),
  );

  try {
    suggestions.value = await $fetch<Suggestion[]>("/api/suggestions");
  } catch {
    // Non-critical
  }
});

async function changeDir() {
  settingDir.value = true;
  try {
    await setDir(dirInput.value);
    await Promise.all([
      fetchAgents(),
      fetchCommands(),
      fetchPlugins(),
      fetchSkills(),
      loadSettings(),
    ]);
  } finally {
    settingDir.value = false;
  }
}

const UNSET_KEY = 'unset';
const modelBreakdown = computed(() => {
  // Build initial counts from the canonical MODEL_IDS list — no hardcoded strings
  const counts: Record<string, number> = Object.fromEntries(
    [...MODEL_IDS, UNSET_KEY].map((k) => [k, 0])
  );
  for (const a of agents.value) {
    const m = a.frontmatter.model;
    const key = m && m in counts ? m : UNSET_KEY;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
});

const totalAgents = computed(() => agents.value.length);
const modelPercentages = computed(() => {
  if (!totalAgents.value) return {};
  const result: Record<string, number> = {};
  for (const [model, count] of Object.entries(modelBreakdown.value)) {
    if (count > 0) result[model] = (count / totalAgents.value) * 100;
  }
  return result;
});


const hasContent = computed(
  () =>
    agents.value.length > 0 ||
    commands.value.length > 0 ||
    skills.value.length > 0 ||
    plugins.value.length > 0,
);

const statItems = computed(() => [
  {
    key: "agents" as const,
    to: "/agents",
    count: animatedCounts.agents,
    label: t('dashboard.agents'),
    icon: "i-lucide-cpu",
  },
  {
    key: "commands" as const,
    to: "/commands",
    count: animatedCounts.commands,
    label: t('dashboard.commands'),
    icon: "i-lucide-terminal",
  },
  {
    key: "skills" as const,
    to: "/skills",
    count: animatedCounts.skills,
    label: t('nav.skills'),
    icon: "i-lucide-sparkles",
  },
  {
    key: "plugins" as const,
    to: "/plugins",
    count: animatedCounts.plugins,
    label: t('nav.plugins'),
    icon: "i-lucide-puzzle",
  },
]);
</script>

<template>
  <div>
    <PageHeader :title="t('dashboard.title')" />

    <div class="px-6 py-5 stagger-section space-y-6">
      <!-- Rebuild Metric Strip Panel (Non-cliché, Integrated Console) -->
      <div class="rounded-xl border border-subtle bg-card overflow-hidden">
        <div class="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-[var(--border-subtle)]">
          <NuxtLink
            v-for="item in statItems"
            :key="item.to"
            :to="item.to"
            class="flex flex-col justify-between p-5 hover-bg group transition-all duration-150 focus-ring"
          >
            <div class="flex items-center justify-between mb-3">
              <span class="text-[11px] font-mono tracking-wider uppercase text-label group-hover:text-[var(--accent)] transition-colors duration-150">
                {{ item.label }}
              </span>
              <UIcon
                :name="item.icon"
                class="size-3.5 text-meta group-hover:text-[var(--accent)] transition-colors duration-150"
              />
            </div>
            <div class="flex items-baseline gap-1.5 mt-1">
              <span class="text-[24px] font-mono font-bold tracking-tight text-primary">
                {{ item.count }}
              </span>
              <span class="text-[10px] text-meta font-mono">active</span>
            </div>
          </NuxtLink>
        </div>
      </div>

      <!-- Model breakdown (visual bar) -->
      <div
        v-if="agents.length > 0"
        class="rounded-xl p-5 border border-subtle bg-card"
      >
        <div class="flex items-center justify-between mb-3.5">
          <span class="text-section-title font-semibold tracking-tight" style="font-family: var(--font-sans);">
            {{ t('dashboard.modelDistribution') }}
          </span>
          <span class="text-[11px] text-meta font-mono">
            {{ totalAgents }} agent{{ totalAgents === 1 ? "" : "s" }}
          </span>
        </div>

        <!-- Proportional bar (Sleek, high-precision) -->
        <div class="proportion-bar h-1.5 mb-4 bg-[var(--surface-inset)] rounded-full overflow-hidden flex gap-[2px]">
          <div
            v-for="(pct, model) in modelPercentages"
            :key="model"
            class="proportion-bar__segment h-full transition-all duration-300"
            :style="{
              flexGrow: pct,
              background: getModelColor(model),
            }"
          />
        </div>

        <!-- Legend (Geist Mono detail tags) -->
        <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div
            v-for="(count, model) in modelBreakdown"
            :key="model"
            class="flex items-center gap-2"
          >
            <div
              class="size-2 rounded-full"
              :style="{ background: getModelColor(model) }"
            />
            <span class="text-[11px] font-medium" style="color: var(--text-secondary);">
              {{ getModelLabel(model) }}
            </span>
            <span class="font-mono text-[10px] tabular-nums text-meta bg-[var(--badge-subtle-bg)] px-1.5 py-0.5 rounded">
              {{ count }}
            </span>
          </div>
        </div>
      </div>

      <!-- Bento grid: Agents + Commands + Quick Actions -->
      <div
        v-if="hasContent"
        class="grid grid-cols-1 md:grid-cols-3 gap-5"
      >
        <!-- Agents list (takes 2 cols) -->
        <div
          class="md:col-span-2 rounded-xl overflow-hidden bg-card border border-subtle flex flex-col"
        >
          <div
            class="flex items-center justify-between px-5 py-4 border-b border-subtle bg-[var(--surface-raised)]"
          >
            <span class="text-section-title flex items-center gap-2 font-semibold">
              <UIcon
                name="i-lucide-cpu"
                class="size-4"
                style="color: var(--accent);"
              />
              {{ t('dashboard.agents') }}
            </span>
            <NuxtLink
              to="/agents"
              class="text-[12px] font-medium focus-ring rounded px-2 py-0.5 hover-bg transition-colors"
              style="color: var(--accent);"
            >
              {{ t('dashboard.viewAll') }}
            </NuxtLink>
          </div>
          <div class="divide-y divide-subtle flex-1">
            <NuxtLink
              v-for="agent in agents.slice(0, 6)"
              :key="agent.slug"
              :to="`/agents/${agent.slug}`"
              class="flex items-center gap-3.5 px-5 py-3.5 hover-bg group transition-all duration-150 relative"
            >
              <div
                class="size-7 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105"
                :style="{
                  background: getAgentColor(agent.frontmatter.color) + '12',
                  border: '1px solid ' + getAgentColor(agent.frontmatter.color) + '20',
                }"
              >
                <UIcon
                  name="i-lucide-cpu"
                  class="size-3.5"
                  :style="{ color: getAgentColor(agent.frontmatter.color) }"
                />
              </div>
              <div class="flex-1 min-w-0">
                <span class="text-[13px] font-medium text-primary truncate block group-hover:text-[var(--accent)] transition-colors duration-150">
                  {{ agent.frontmatter.name }}
                </span>
                <span
                  v-if="agent.frontmatter.description"
                  class="text-[11px] text-label truncate block mt-0.5"
                >
                  {{ agent.frontmatter.description }}
                </span>
              </div>
              <span
                v-if="agent.frontmatter.model && getModelBadgeClasses(agent.frontmatter.model)"
                class="text-[9px] font-mono font-medium px-2 py-0.5 rounded-full shrink-0"
                :class="[
                  getModelBadgeClasses(agent.frontmatter.model).bg,
                  getModelBadgeClasses(agent.frontmatter.model).text,
                ]"
              >
                {{ agent.frontmatter.model }}
              </span>
            </NuxtLink>
          </div>
        </div>

        <!-- Right column: Commands + Quick Actions stacked -->
        <div class="space-y-5">
          <!-- Commands panel -->
          <div
            class="rounded-xl overflow-hidden bg-card border border-subtle flex flex-col"
          >
            <div
              class="flex items-center justify-between px-5 py-4 border-b border-subtle bg-[var(--surface-raised)]"
            >
              <h3 class="text-section-title flex items-center gap-2 font-semibold">
                <UIcon
                  name="i-lucide-terminal"
                  class="size-4"
                  style="color: var(--accent);"
                />
                {{ t('dashboard.commands') }}
              </h3>
              <NuxtLink
                to="/commands"
                class="text-[12px] font-medium focus-ring rounded px-2 py-0.5 hover-bg transition-colors"
                style="color: var(--accent);"
              >
                {{ t('dashboard.viewAll') }}
              </NuxtLink>
            </div>
            <div class="divide-y divide-subtle">
              <NuxtLink
                v-for="cmd in commands.slice(0, 4)"
                :key="cmd.slug"
                :to="`/commands/${cmd.slug}`"
                class="flex items-center gap-2.5 px-5 py-3 hover-bg group transition-all duration-150"
              >
                <span class="font-mono text-[11px] shrink-0 text-meta group-hover:text-[var(--accent)] transition-colors">
                  /
                </span>
                <span class="text-[12px] font-mono truncate text-secondary group-hover:text-primary transition-colors flex-1">
                  {{ cmd.frontmatter.name }}
                </span>
                <span class="text-[9px] shrink-0 text-meta font-mono bg-[var(--badge-subtle-bg)] px-1.5 py-0.5 rounded">
                  {{ cmd.directory }}
                </span>
              </NuxtLink>
            </div>
          </div>

          <!-- Quick Actions panel list (Integrated clean layout) -->
          <div class="space-y-2.5">
            <NuxtLink
              to="/graph"
              class="flex items-center gap-3.5 p-4 rounded-xl border border-subtle bg-card hover-card-accent group transition-all duration-150 focus-ring"
            >
              <div
                class="size-8 rounded-lg flex items-center justify-center shrink-0"
                style="background: var(--accent-muted); border: 1px solid var(--accent-glow);"
              >
                <UIcon
                  name="i-lucide-workflow"
                  class="size-4 animate-pulse"
                  style="color: var(--accent);"
                />
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-[13px] font-medium text-primary group-hover:text-[var(--accent)] transition-colors">
                  {{ t('dashboard.relationshipGraph') }}
                </div>
                <div class="text-[11px] text-label mt-0.5">
                  {{ t('dashboard.visualizeConnections') }}
                </div>
              </div>
              <UIcon
                name="i-lucide-arrow-right"
                class="size-3.5 text-meta opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-0.5"
              />
            </NuxtLink>

            <NuxtLink
              to="/workflows"
              class="flex items-center gap-3.5 p-4 rounded-xl border border-subtle bg-card hover-card-accent group transition-all duration-150 focus-ring"
            >
              <div
                class="size-8 rounded-lg flex items-center justify-center shrink-0"
                style="background: var(--accent-secondary-muted); border: 1px solid rgba(154, 125, 255, 0.15);"
              >
                <UIcon
                  name="i-lucide-git-branch"
                  class="size-4"
                  style="color: var(--accent-secondary);"
                />
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-[13px] font-medium text-primary group-hover:text-[var(--accent-secondary)] transition-colors">
                  {{ t('dashboard.createWorkflow') }}
                </div>
                <div class="text-[11px] text-label mt-0.5">
                  {{ t('dashboard.multiStepPipelines') }}
                </div>
              </div>
              <UIcon
                name="i-lucide-arrow-right"
                class="size-3.5 text-meta opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-0.5"
              />
            </NuxtLink>

            <NuxtLink
              to="/explore"
              class="flex items-center gap-3.5 p-4 rounded-xl border border-subtle bg-card hover-card-accent group transition-all duration-150 focus-ring"
            >
              <div
                class="size-8 rounded-lg flex items-center justify-center shrink-0"
                style="background: var(--accent-muted); border: 1px solid var(--accent-glow);"
              >
                <UIcon
                  name="i-lucide-compass"
                  class="size-4"
                  style="color: var(--accent);"
                />
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-[13px] font-medium text-primary group-hover:text-[var(--accent)] transition-colors">
                  {{ t('dashboard.explore') }}
                </div>
                <div class="text-[11px] text-label mt-0.5">
                  {{ t('dashboard.templatesExtensions') }}
                </div>
              </div>
              <UIcon
                name="i-lucide-arrow-right"
                class="size-3.5 text-meta opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-0.5"
              />
            </NuxtLink>
          </div>
        </div>
      </div>

      <!-- Welcome onboarding (first-run) -->
      <WelcomeOnboarding
        v-if="!hasContent"
        @created="(agent) => navigateTo(`/agents/${agent.slug}`)"
      />

      <!-- Suggestions Panel (Terminal Warning style) -->
      <div
        v-if="suggestions.length && hasContent"
        class="rounded-xl overflow-hidden bg-card border border-subtle"
      >
        <div
          class="flex items-center justify-between px-5 py-3.5 border-b border-subtle bg-[var(--surface-raised)]"
        >
          <h3 class="text-section-title flex items-center gap-2 font-semibold">
            <UIcon
              name="i-lucide-lightbulb"
              class="size-4 text-amber-400"
            />
            {{ t('dashboard.suggestions') }}
          </h3>
          <span class="font-mono text-[10px] text-meta bg-[var(--badge-subtle-bg)] px-2 py-0.5 rounded-full">
            {{ suggestions.length }}
          </span>
        </div>
        <div class="divide-y divide-subtle">
          <NuxtLink
            v-for="(s, idx) in suggestions.slice(0, 5)"
            :key="idx"
            :to="`/${s.target.type}s/${s.target.slug}`"
            class="flex items-center gap-3 px-5 py-3 hover-bg group transition-all duration-150"
          >
            <UIcon
              :name="s.severity === 'warning' ? 'i-lucide-alert-triangle' : 'i-lucide-info'"
              class="size-4 shrink-0"
              :style="{
                color: s.severity === 'warning' ? 'var(--warning)' : 'var(--text-disabled)',
              }"
            />
            <span class="text-[12px] text-secondary flex-1 group-hover:text-primary transition-colors">
              {{ s.message }}
            </span>
            <UIcon
              name="i-lucide-chevron-right"
              class="size-3.5 text-meta opacity-0 group-hover:opacity-100 transition-opacity"
            />
          </NuxtLink>
        </div>
      </div>

      <!-- Advanced settings panel -->
      <details class="group">
        <summary
          class="text-[12px] flex items-center gap-1.5 text-meta cursor-pointer select-none hover:text-secondary transition-colors"
        >
          <UIcon
            name="i-lucide-settings"
            class="size-3 group-open:rotate-45 transition-transform"
          />
          {{ t('dashboard.advanced') }}
        </summary>
        <div class="rounded-xl p-5 mt-2 bg-card border border-subtle">
          <p class="text-[12px] mb-3 text-label leading-relaxed">
            {{ t('dashboard.advancedDescription') }}
          </p>
          <div class="flex items-center gap-3">
            <UIcon
              name="i-lucide-folder"
              class="size-4 shrink-0 text-meta"
            />
            <form
              class="flex-1 flex gap-2.5"
              @submit.prevent="changeDir"
            >
              <input
                v-model="dirInput"
                placeholder="~/.claude"
                class="field-input flex-1"
              />
              <UButton
                type="submit"
                :loading="settingDir"
                label="Load"
                size="sm"
                variant="soft"
              />
            </form>
          </div>
        </div>
      </details>

      <!-- Keyboard shortcuts footer -->
      <div class="flex items-center gap-4 px-2 text-meta">
        <span class="text-[12px] flex items-center gap-1.5">
          <kbd class="text-[10px] font-mono px-1.5 py-0.5 rounded border border-subtle bg-[var(--badge-subtle-bg)]">⌘K</kbd>
          Search
        </span>
        <span class="text-[12px] flex items-center gap-1.5">
          <kbd class="text-[10px] font-mono px-1.5 py-0.5 rounded border border-subtle bg-[var(--badge-subtle-bg)]">⌘S</kbd>
          Save
        </span>
      </div>
    </div>
  </div>
</template>
