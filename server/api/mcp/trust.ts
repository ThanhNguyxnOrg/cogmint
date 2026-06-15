import { isWorkspaceTrusted, addTrustedDir, removeTrustedDir } from '../../utils/workspaceTrust'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export default defineEventHandler(async (event) => {
  const method = getMethod(event)

  if (method === 'GET') {
    const { workingDir } = getQuery(event) as { workingDir?: string }
    if (!workingDir) {
      throw createError({ statusCode: 400, message: 'Working directory is required' })
    }
    const trusted = await isWorkspaceTrusted(workingDir)
    const projectPath = join(workingDir, '.mcp.json')
    const hasProjectConfig = existsSync(projectPath)
    return { trusted, hasProjectConfig }
  }

  if (method === 'POST') {
    const body = await readBody<{ workingDir: string; trust: boolean }>(event)
    if (!body.workingDir) {
      throw createError({ statusCode: 400, message: 'Working directory is required' })
    }
    if (body.trust) {
      await addTrustedDir(body.workingDir)
    } else {
      await removeTrustedDir(body.workingDir)
    }
    return { success: true }
  }

  throw createError({ statusCode: 405, message: 'Method Not Allowed' })
})
