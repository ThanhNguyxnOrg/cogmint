<script setup lang="ts">
defineProps<{
  title: string
}>()
</script>

<template>
  <div
    class="h-16 flex items-center gap-3 px-6 shrink-0 sticky top-0 z-100"
    style="border-bottom: 1px solid var(--border-subtle); background: color-mix(in srgb, var(--surface-base) 88%, #2f6fff 12%); backdrop-filter: blur(14px);"
  >
    <slot name="leading" />
    <h1 class="text-page-title flex-1 flex items-center gap-2.5">
      {{ title }}
      <slot name="trailing" />
    </h1>
    <div class="flex items-center gap-2">
      <slot name="right" />
    </div>
  </div>
</template>
