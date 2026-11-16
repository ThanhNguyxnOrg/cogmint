import { describe, test, expect } from 'vitest'
import { normalizeSDKMessage } from '../server/utils/messageNormalizer'

describe('Claude SDK message normalization', () => {
  test('preserves the SDK tool-use ID on tool progress heartbeats', () => {
    const [message] = normalizeSDKMessage(
      {
        type: 'tool_progress',
        tool_name: 'Read',
        tool_use_id: 'hook-123',
        elapsed_time_seconds: 4,
      },
      'session-1',
    )

    expect(message).toMatchObject({
      kind: 'tool_use',
      sessionId: 'session-1',
      toolName: 'Read',
      metadata: {
        toolUseId: 'hook-123',
        elapsed: 4,
        status: 'running',
      },
    })
  })
})
