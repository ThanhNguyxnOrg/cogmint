import { describe, test, expect } from 'vitest'
import { resolveClaudePath } from '../server/utils/claudeDir'

describe('Claude Dir Security & Resolution', () => {
  test('resolveClaudePath resolves standard segments', () => {
    const path = resolveClaudePath('agents', 'code-reviewer.md')
    expect(path).toContain('agents')
    expect(path).toContain('code-reviewer.md')
  })

  test('resolveClaudePath blocks path traversal', () => {
    expect(() => {
      resolveClaudePath('agents', '..', '..', 'unauthorized.txt')
    }).toThrow(/path traversal/i)
  })
})
