/**
 * Canonical model configuration for the server side.
 *
 * Keep in sync conceptually with `app/utils/models.ts` (the frontend twin).
 * The server cannot import from `app/` (different module context), so this
 * file mirrors the model list and adds server-specific concerns (pricing).
 *
 * Source: https://www.anthropic.com/pricing
 */

export type ModelId = string

export interface ModelPricing {
  /** USD per 1M input tokens */
  input: number
  /** USD per 1M output tokens */
  output: number
  /** USD per 1M cache-read tokens */
  cached: number
}

export interface ServerModelMeta {
  id: string
  /** Max context window in tokens */
  contextWindow: number
  pricing: ModelPricing
}

/** Fallback pricing when model is unknown */
export const DEFAULT_PRICING: ModelPricing = { input: 3.0, output: 15.0, cached: 0.3 }

/** Default context window when model is unknown */
export const DEFAULT_CONTEXT_WINDOW = 200_000

import { getCachedClaudeInfo } from './claudeInfo'

/**
 * Resolve a model string (either a full id like "claude-sonnet-4" or an alias
 * like "sonnet") to the canonical ServerModelMeta.
 */
export function resolveModelMeta(model: string | undefined): ServerModelMeta | undefined {
  const info = getCachedClaudeInfo()
  let modelToResolve = model

  // If model is 'default' or undefined, try to resolve using the active model from settings
  if (!modelToResolve || modelToResolve === 'default') {
    modelToResolve = info?.appliedSettings?.applied?.model
  }

  if (modelToResolve) {
    // 1. Try to resolve from probed models first
    if (info?.supportedModels && info.supportedModels.length > 0) {
      let matched = info.supportedModels.find(m => m.value === modelToResolve)
      if (!matched) {
        const lower = modelToResolve.toLowerCase()
        matched = info.supportedModels.find(m => {
          const valLower = m.value.toLowerCase()
          const dispLower = m.displayName.toLowerCase()
          return valLower.includes(lower) || lower.includes(valLower) ||
                 dispLower.includes(lower) || lower.includes(dispLower)
        })
      }

      if (matched) {
        return {
          id: matched.value,
          contextWindow: matched.contextWindow,
          pricing: matched.pricing
        }
      }
    }
  }

  const lookupModel = modelToResolve || model || 'claude-3-5-sonnet'
  const lower = lookupModel.toLowerCase()

  // Dynamic fallback / parsing
  let contextWindow = DEFAULT_CONTEXT_WINDOW
  let input = DEFAULT_PRICING.input
  let output = DEFAULT_PRICING.output

  if (lower.includes('opus')) {
    contextWindow = 1_000_000
    input = 15.0
    output = 75.0
  } else if (lower.includes('haiku')) {
    contextWindow = 200_000
    input = 0.8
    output = 4.0
  } else if (lower.includes('sonnet')) {
    contextWindow = 200_000
    input = 3.0
    output = 15.0
  }

  // Look for direct numeric hints in the string
  if (lower.includes('1m')) {
    contextWindow = 1_000_000
  } else if (lower.includes('200k')) {
    contextWindow = 200_000
  }

  return {
    id: lookupModel,
    contextWindow,
    pricing: {
      input,
      output,
      cached: Number((input * 0.1).toFixed(4))
    }
  }
}

/**
 * Return the pricing for a model string. Falls back to DEFAULT_PRICING.
 */
export function getModelPricing(model: string | undefined): ModelPricing {
  return resolveModelMeta(model)?.pricing ?? DEFAULT_PRICING
}

/**
 * Return the context window for a model string. Falls back to DEFAULT_CONTEXT_WINDOW.
 */
export function getModelContextWindow(model: string | undefined): number {
  return resolveModelMeta(model)?.contextWindow ?? DEFAULT_CONTEXT_WINDOW
}

/**
 * Lookup: display label for a model (falls back to the raw string)
 */
export function getModelLabel(model: string | undefined): string {
  if (!model || model === 'default') return 'Default'
  const lower = model.toLowerCase()
  if (lower.includes('opus')) return 'Claude 3 Opus'
  if (lower.includes('sonnet')) return 'Claude 3.5 Sonnet'
  if (lower.includes('haiku')) return 'Claude 3.5 Haiku'
  return model.split(/[-_]/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}
