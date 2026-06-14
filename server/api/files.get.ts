import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join, isAbsolute, resolve } from 'node:path'
import { getClaudeDir } from '../utils/claudeDir'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const path = query.path as string
  const projectDir = query.projectDir as string

  if (!path) {
    throw createError({ statusCode: 400, message: 'Path is required' })
  }

  const claudeDir = resolve(getClaudeDir())
  const baseDir = projectDir && existsSync(projectDir) ? resolve(projectDir) : claudeDir
  
  // Resolve path to its absolute and normalized form
  const resolvedPath = resolve(isAbsolute(path) ? path : join(baseDir, path))

  // Security check: ensure the file is within baseDir OR claudeDir
  const isInsideAllowedDir = resolvedPath.startsWith(baseDir) || resolvedPath.startsWith(claudeDir)
  if (!isInsideAllowedDir) {
    throw createError({ statusCode: 403, message: 'Access denied: Path is outside allowed directories' })
  }

  if (!existsSync(resolvedPath)) {
    throw createError({ statusCode: 404, message: `File not found: ${resolvedPath}` })
  }

  try {
    const content = await readFile(resolvedPath, 'utf-8')
    return { content, path: resolvedPath }
  } catch (err: any) {
    throw createError({ statusCode: 500, message: `Failed to read file: ${err.message}` })
  }
})
