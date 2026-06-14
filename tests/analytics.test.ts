import { describe, test, expect } from 'vitest'
import { calculateCost } from '../server/utils/contextMonitor'
import { getModelPricing, SERVER_MODEL_META } from '../server/utils/models'

describe('Analytics Metrics & Cost Utilities', () => {
  test('getModelPricing resolves sonnet pricing correctly', () => {
    const pricing = getModelPricing('claude-sonnet-4')
    expect(pricing.input).toBe(3.0)
    expect(pricing.output).toBe(15.0)
    expect(pricing.cached).toBe(0.3)
  })

  test('getModelPricing resolves short alias correctly', () => {
    const pricing = getModelPricing('haiku')
    expect(pricing.input).toBe(0.8)
    expect(pricing.output).toBe(4.0)
    expect(pricing.cached).toBe(0.08)
  })

  test('getModelPricing falls back to sonnet for unknown model', () => {
    const pricing = getModelPricing('unknown-model-xyz')
    expect(pricing.input).toBe(3.0) // fallback default sonnet
  })

  test('calculateCost computes standard model runs correctly', () => {
    const tokens = {
      input: 100_000,   // 0.1M
      output: 20_000,   // 0.02M
      cached: 50_000,   // 0.05M
    }
    
    // claude-sonnet-4 prices: In: $3/M, Out: $15/M, Cache: $0.3/M
    // cost = 0.1 * 3.0 + 0.02 * 15.0 + 0.05 * 0.3
    // cost = 0.3 + 0.3 + 0.015 = 0.615
    const cost = calculateCost(tokens, 'sonnet')
    expect(cost.total).toBeCloseTo(0.615)
    expect(cost.input).toBeCloseTo(0.3)
    expect(cost.output).toBeCloseTo(0.3)
    expect(cost.cached).toBeCloseTo(0.015)
  })

  test('calculateCost computes haiku runs correctly', () => {
    const tokens = {
      input: 500_000,  // 0.5M
      output: 50_000,  // 0.05M
      cached: 100_000, // 0.1M
    }
    
    // claude-haiku-4 prices: In: $0.8/M, Out: $4.0/M, Cache: $0.08/M
    // cost = 0.5 * 0.8 + 0.05 * 4.0 + 0.1 * 0.08
    // cost = 0.4 + 0.2 + 0.008 = 0.608
    const cost = calculateCost(tokens, 'haiku')
    expect(cost.total).toBeCloseTo(0.608)
    expect(cost.input).toBeCloseTo(0.4)
    expect(cost.output).toBeCloseTo(0.2)
    expect(cost.cached).toBeCloseTo(0.008)
  })
})
