import { query } from '@anthropic-ai/claude-agent-sdk'

export interface ProbedModel {
  value: string
  displayName: string
  description: string
  contextWindow: number
  pricing: {
    input: number
    output: number
    cached: number
  }
}

export interface ClaudeCliInfo {
  supportedModels: ProbedModel[]
  appliedSettings: any
  lastProbed: number
}

let cachedClaudeInfo: ClaudeCliInfo | null = null

// Fallback models when SDK/CLI probe fails
const FALLBACK_MODELS: ProbedModel[] = [
  {
    value: 'default',
    displayName: 'Default (recommended)',
    description: 'Use the default model configured in settings.',
    contextWindow: 1_000_000,
    pricing: { input: 5.0, output: 25.0, cached: 0.5 }
  },
  {
    value: 'sonnet',
    displayName: 'Sonnet',
    description: 'Best balance of speed and quality. Good for most tasks.',
    contextWindow: 200_000,
    pricing: { input: 3.0, output: 15.0, cached: 0.3 }
  },
  {
    value: 'haiku',
    displayName: 'Haiku',
    description: 'Fastest and cheapest. Great for simple, repetitive tasks.',
    contextWindow: 200_000,
    pricing: { input: 1.0, output: 5.0, cached: 0.1 }
  },
  {
    value: 'opus',
    displayName: 'Opus',
    description: 'Most capable. Best for complex reasoning and nuanced tasks.',
    contextWindow: 1_000_000,
    pricing: { input: 15.0, output: 75.0, cached: 1.5 }
  }
]

export function parseModelMetaFromSDK(sdkModel: any): ProbedModel {
  const value = sdkModel.value
  const displayName = sdkModel.displayName || value
  const description = sdkModel.description || ''

  const descLower = description.toLowerCase()
  const valLower = value.toLowerCase()

  // 1. Context Window Parsing
  let contextWindow = 200_000 // default fallback

  const milMatch = (valLower + ' ' + descLower).match(/(\d+)\s*(?:million|m)\b/)
  const kMatch = (valLower + ' ' + descLower).match(/(\d+)\s*(?:thousand|k)\b/)
  const commaMatch = (valLower + ' ' + descLower).match(/(\d{1,3}(?:,\d{3})+)\b/)

  if (milMatch) {
    contextWindow = parseInt(milMatch[1]!) * 1_000_000
  } else if (commaMatch) {
    contextWindow = parseInt(commaMatch[1]!.replace(/,/g, ''))
  } else if (kMatch) {
    contextWindow = parseInt(kMatch[1]!) * 1_000
  } else if (valLower.includes('opus') || descLower.includes('opus')) {
    contextWindow = 1_000_000
  }

  // 2. Pricing Parsing
  let inputPrice = 3.0
  let outputPrice = 15.0

  const pricingMatch = descLower.match(/\$(\d+(?:\.\d+)?)\/\$(\d+(?:\.\d+)?)/)
  if (pricingMatch) {
    inputPrice = parseFloat(pricingMatch[1]!)
    outputPrice = parseFloat(pricingMatch[2]!)
  } else {
    // Substring fallback
    if (valLower.includes('haiku') || descLower.includes('haiku')) {
      inputPrice = 1.0
      outputPrice = 5.0
    } else if (valLower.includes('opus') || descLower.includes('opus')) {
      inputPrice = 15.0
      outputPrice = 75.0
    }
  }

  // Anthropic prompt caching read discount is 90% (cost is 10% of input)
  const cachedPrice = Number((inputPrice * 0.1).toFixed(4))

  return {
    value,
    displayName,
    description,
    contextWindow,
    pricing: {
      input: inputPrice,
      output: outputPrice,
      cached: cachedPrice,
    },
  }
}

export async function getClaudeInfo(bypassCache = false): Promise<ClaudeCliInfo> {
  const now = Date.now()
  if (cachedClaudeInfo && !bypassCache && (now - cachedClaudeInfo.lastProbed < 5 * 60 * 1000)) {
    return cachedClaudeInfo
  }

  let q: any = null
  let timeoutId: any = null

  try {
    console.log('[Claude Info] Probing Claude SDK for dynamic models & settings...')
    
    // Create query
    q = query({
      prompt: 'probe',
      options: {
        maxTurns: 0,
      },
    })

    // Create a 3-second timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Timeout probing Claude SDK')), 3000)
    })

    // Execute query calls
    const probePromise = Promise.all([
      q.supportedModels().catch(() => []),
      q.getSettings().catch(() => ({})),
    ])

    // Race the query against the timeout
    const [models, settings] = await Promise.race([probePromise, timeoutPromise]) as [any[], any]
    
    // Clear timeout if successful
    if (timeoutId) clearTimeout(timeoutId)

    const parsedModels = (models || []).map((m: any) => parseModelMetaFromSDK(m))

    cachedClaudeInfo = {
      supportedModels: parsedModels.length > 0 ? parsedModels : FALLBACK_MODELS,
      appliedSettings: settings || {},
      lastProbed: now,
    }
    console.log('[Claude Info] Dynamic CLI info cached successfully. Default model:', settings?.applied?.model)
    return cachedClaudeInfo
  } catch (error) {
    console.error('[Claude Info] Failed to probe Claude SDK info, using offline fallbacks:', error)
    if (timeoutId) clearTimeout(timeoutId)

    cachedClaudeInfo = {
      supportedModels: FALLBACK_MODELS,
      appliedSettings: { applied: { model: 'sonnet' } },
      lastProbed: now,
    }
    return cachedClaudeInfo
  } finally {
    if (q) {
      try {
        q.close()
      } catch (err) {
        // ignore close errors
      }
    }
  }
}

export function getCachedClaudeInfo(): ClaudeCliInfo | null {
  return cachedClaudeInfo
}
