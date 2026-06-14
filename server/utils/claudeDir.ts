import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

let currentClaudeDir: string | null = null

export function getClaudeDir(): string {
  if (!currentClaudeDir) {
    const envDir = process.env.CLAUDE_DIR
    currentClaudeDir = envDir || join(homedir(), '.claude')
  }
  return currentClaudeDir
}

export function setClaudeDir(dir: string): void {
  if (!existsSync(dir)) {
    const err = new Error(`Directory does not exist: ${dir}`)
    ;(err as any).statusCode = 400
    throw err
  }
  currentClaudeDir = dir
}

export function resolveClaudePath(...segments: string[]): string {
  const base = resolve(getClaudeDir())
  const resolved = resolve(base, ...segments)
  if (!resolved.startsWith(base)) {
    const err = new Error('Security check failed: Path traversal detected')
    ;(err as any).statusCode = 400
    throw err
  }
  return resolved
}
