export interface ModelPrice {
  modelId: string
  provider: string
  inputPerMtok: number
  outputPerMtok: number
  cacheReadPerMtok: number
  cacheWritePerMtok: number
}

export interface HarnessUsage {
  harnessId: string
  costUsd: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  messageCount: number
}

export interface ModelUsage {
  modelId: string
  costUsd: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

export interface DailySpend {
  date: string
  costUsd: number
  byHarness: Record<string, number>
}

export interface UsageSummary {
  totalCostUsd: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheReadTokens: number
  totalCacheWriteTokens: number
  byHarness: HarnessUsage[]
  byModel: ModelUsage[]
  byDay: DailySpend[]
  pricingUpdatedAt: string
}
