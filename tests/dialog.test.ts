import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { exec } from 'node:child_process'

// Mock Nuxt handler globals for testing
// @ts-ignore
global.defineEventHandler = (fn: any) => fn
// @ts-ignore
global.createError = (err: any) => new Error(typeof err === 'string' ? err : err.message)

// Mock child_process exec
vi.mock('node:child_process', () => ({
  exec: vi.fn()
}))

describe('Native Folder Picker Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('successfully triggers native file dialogs', async () => {
    // Import event handler inside the test to allow mock attachment
    const handler = (await import('../server/api/dialog/select-directory.post')).default

    // Mock successful execution returning path
    const mockPath = '/mock/selected/directory'
    vi.mocked(exec).mockImplementation((cmd, options, callback) => {
      const cb = typeof options === 'function' ? options : callback
      if (cb) cb(null, mockPath, '')
      return {} as any
    })

    const event = { node: { req: {}, res: {} } } as any
    const result = await handler(event)

    expect(exec).toHaveBeenCalled()
    expect(result.path).toBe(mockPath)
  })

  test('handles cancelled dialog gracefully returning null', async () => {
    const handler = (await import('../server/api/dialog/select-directory.post')).default

    // Mock cancelled dialog (error response)
    vi.mocked(exec).mockImplementation((cmd, options, callback) => {
      const cb = typeof options === 'function' ? options : callback
      if (cb) cb(new Error('User cancelled'), '', '')
      return {} as any
    })

    const event = { node: { req: {}, res: {} } } as any
    const result = await handler(event)

    expect(result.path).toBeNull()
  })
})
