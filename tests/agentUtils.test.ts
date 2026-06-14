import { describe, test, expect } from 'vitest'
import { encodeAgentSlug, decodeAgentSlug } from '../server/utils/agentUtils'

describe('Agent Slug Utilities', () => {
  test('encodeAgentSlug should encode flat name', () => {
    expect(encodeAgentSlug('', 'code-reviewer')).toBe('code-reviewer')
  })

  test('encodeAgentSlug should encode nested directory', () => {
    expect(encodeAgentSlug('engineering', 'code-reviewer')).toBe('engineering--code-reviewer')
    expect(encodeAgentSlug('engineering/infra', 'deployer')).toBe('engineering--infra--deployer')
  })

  test('decodeAgentSlug should decode flat slug', () => {
    const decoded = decodeAgentSlug('code-reviewer')
    expect(decoded.directory).toBe('')
    expect(decoded.name).toBe('code-reviewer')
  })

  test('decodeAgentSlug should decode nested slug', () => {
    const decoded = decodeAgentSlug('engineering--code-reviewer')
    expect(decoded.directory).toBe('engineering')
    expect(decoded.name).toBe('code-reviewer')
  })

  test('decodeAgentSlug should handle multiple hyphens correctly', () => {
    const decoded = decodeAgentSlug('engineering--infra--deployer-bot')
    expect(decoded.directory).toBe('engineering/infra')
    expect(decoded.name).toBe('deployer-bot')
  })
})
