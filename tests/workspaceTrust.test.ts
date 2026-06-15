import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtemp, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { setClaudeDir } from '../server/utils/claudeDir'
import {
  readTrustedDirs,
  addTrustedDir,
  removeTrustedDir,
  isWorkspaceTrusted
} from '../server/utils/workspaceTrust'

describe('Workspace Trust System', () => {
  let tempClaudeDir: string

  beforeAll(async () => {
    // Set up isolated temp directory for CLAUDE_DIR to avoid contaminating real config
    tempClaudeDir = await mkdtemp(join(tmpdir(), 'cogmint-test-'))
    setClaudeDir(tempClaudeDir)
  })

  afterAll(async () => {
    // Clean up temporary directory
    if (existsSync(tempClaudeDir)) {
      await rm(tempClaudeDir, { recursive: true, force: true })
    }
  })

  test('initially has no trusted directories', async () => {
    const dirs = await readTrustedDirs()
    expect(dirs).toEqual([])
  })

  test('checks untrusted workspace', async () => {
    const isTrusted = await isWorkspaceTrusted('/some/untrusted/path')
    expect(isTrusted).toBe(false)
  })

  test('adds trusted workspace directory', async () => {
    const targetDir = '/some/path/to/project'
    await addTrustedDir(targetDir)

    const dirs = await readTrustedDirs()
    expect(dirs.length).toBe(1)
    expect(dirs[0]).toContain('project')

    const isTrusted = await isWorkspaceTrusted(targetDir)
    expect(isTrusted).toBe(true)
  })

  test('avoids duplicate entries', async () => {
    const targetDir = '/some/path/to/project'
    await addTrustedDir(targetDir)
    await addTrustedDir(targetDir)

    const dirs = await readTrustedDirs()
    expect(dirs.length).toBe(1)
  })

  test('removes trusted directory', async () => {
    const targetDir = '/some/path/to/project'
    await addTrustedDir(targetDir)
    await removeTrustedDir(targetDir)

    const isTrusted = await isWorkspaceTrusted(targetDir)
    expect(isTrusted).toBe(false)

    const dirs = await readTrustedDirs()
    expect(dirs).toEqual([])
  })
})
