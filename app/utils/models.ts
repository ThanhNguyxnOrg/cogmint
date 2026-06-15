import type { AgentModel } from '~/types'

/** Default model used when none is specified */
export const DEFAULT_MODEL: AgentModel = 'sonnet'

// ─── Derived helpers ──────────────────────────────────────────────────────────

/** Lookup: human-readable tagline for a model */
export function getModelTagline(model: string | undefined): string {
  if (!model || model === 'default') return 'Uses configured default'
  const lower = model.toLowerCase()
  if (lower.includes('opus')) return 'Most capable'
  if (lower.includes('sonnet')) return 'Balanced'
  if (lower.includes('haiku')) return 'Fast & efficient'
  return 'Claude model'
}

/** Lookup: display label for a model (falls back to the raw string) */
export function getModelLabel(model: string | undefined): string {
  if (!model || model === 'default') return 'Default'
  const lower = model.toLowerCase()
  if (lower.includes('opus')) return 'Opus'
  if (lower.includes('sonnet')) return 'Sonnet'
  if (lower.includes('haiku')) return 'Haiku'
  // Clean format: capitalize parts of model name
  return model.split(/[-_]/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

/** Lookup: chart/graph hex color for a model */
export function getModelColor(model: string | undefined): string {
  if (!model || model === 'default') return '#71717a'
  const lower = model.toLowerCase()
  if (lower.includes('opus')) return '#7C3AED' // purple
  if (lower.includes('sonnet')) return '#2563EB' // blue
  if (lower.includes('haiku')) return '#D97706' // amber
  return '#64748b' // slate
}

/**
 * Lookup: Tailwind badge classes {bg, text} for a model.
 * Returns neutral classes when model is unknown.
 */
export function getModelBadgeClasses(model: string | undefined): { bg: string; text: string } {
  if (!model || model === 'default') {
    return { bg: 'bg-zinc-500/15', text: 'text-zinc-400' }
  }
  const lower = model.toLowerCase()
  if (lower.includes('opus')) return { bg: 'bg-purple-500/15', text: 'text-purple-400' }
  if (lower.includes('sonnet')) return { bg: 'bg-blue-500/15', text: 'text-blue-400' }
  if (lower.includes('haiku')) return { bg: 'bg-amber-500/15', text: 'text-amber-400' }
  return { bg: 'bg-slate-500/15', text: 'text-slate-400' }
}

/**
 * Lookup: inline style object for model badge (for use in non-Tailwind contexts
 * such as graph nodes where dynamic Tailwind classes are purged).
 */
export function getModelBadgeStyle(model: string | undefined): {
  background: string
  color: string
} {
  const hex = getModelColor(model)
  return {
    background: `${hex}26`, // ~15% opacity
    color: hex,
  }
}

/**
 * Get context window size for a model (with fallback/regex detection).
 */
export function getModelContextWindow(model: string | undefined): number {
  if (!model || model === 'default') return 200_000
  const lower = model.toLowerCase()
  if (lower.includes('opus')) return 1_000_000
  if (lower.includes('sonnet')) return 200_000
  if (lower.includes('haiku')) return 200_000
  return 200_000
}
