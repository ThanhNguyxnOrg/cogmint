import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolveClaudePath } from './claudeDir'
import { resolve } from 'node:path'

export interface TrustedDirsRegistry {
  trustedDirs: string[]
}

export function getTrustedDirsPath(): string {
  return resolveClaudePath('cogmint-trusted-dirs.json')
}

export async function readTrustedDirs(): Promise<string[]> {
  const path = getTrustedDirsPath()
  if (!existsSync(path)) return []
  try {
    const raw = await readFile(path, 'utf-8')
    const parsed = JSON.parse(raw) as TrustedDirsRegistry
    return Array.isArray(parsed.trustedDirs) ? parsed.trustedDirs.map(d => resolve(d)) : []
  } catch {
    return []
  }
}

export async function addTrustedDir(dir: string): Promise<void> {
  const resolvedDir = resolve(dir)
  const dirs = await readTrustedDirs()
  if (!dirs.includes(resolvedDir)) {
    dirs.push(resolvedDir)
    const path = getTrustedDirsPath()
    await writeFile(path, JSON.stringify({ trustedDirs: dirs }, null, 2), 'utf-8')
  }
}

export async function removeTrustedDir(dir: string): Promise<void> {
  const resolvedDir = resolve(dir)
  const dirs = await readTrustedDirs()
  const filtered = dirs.filter(d => d !== resolvedDir)
  const path = getTrustedDirsPath()
  await writeFile(path, JSON.stringify({ trustedDirs: filtered }, null, 2), 'utf-8')
}

export async function isWorkspaceTrusted(dir: string): Promise<boolean> {
  if (!dir) return false
  const resolvedDir = resolve(dir)
  const dirs = await readTrustedDirs()
  return dirs.includes(resolvedDir)
}
