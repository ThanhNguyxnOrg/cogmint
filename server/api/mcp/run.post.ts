import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { isWorkspaceTrusted } from '../../utils/workspaceTrust'
import { callMcpTool } from '../../utils/mcpRunner'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    name: string
    scope: 'global' | 'project'
    tool: string
    arguments?: any
    workingDir?: string
  }>(event)

  const { name, scope, tool, arguments: args, workingDir } = body

  if (!name || !scope || !tool) {
    throw createError({ statusCode: 400, message: 'Server name, scope, and tool name are required' })
  }

  let filePath = ''
  if (scope === 'global') {
    filePath = join(homedir(), '.claude.json')
  } else if (scope === 'project') {
    if (!workingDir || typeof workingDir !== 'string') {
      throw createError({ statusCode: 400, message: 'Working directory is required for project scope' })
    }
    filePath = join(workingDir, '.mcp.json')

    // Block process execution if workspace is untrusted (RCE protection)
    const trusted = await isWorkspaceTrusted(workingDir)
    if (!trusted) {
      throw createError({
        statusCode: 403,
        message: 'Workspace is untrusted. Tool execution is blocked for security.'
      })
    }
  } else {
    throw createError({ statusCode: 400, message: 'Invalid scope' })
  }

  if (!existsSync(filePath)) {
    throw createError({ statusCode: 404, message: 'Configuration file not found' })
  }

  try {
    const raw = await readFile(filePath, 'utf-8')
    const data = JSON.parse(raw)
    
    if (!data.mcpServers || !data.mcpServers[name]) {
      throw createError({ statusCode: 404, message: 'Server configuration not found' })
    }

    const config = data.mcpServers[name]
    if (config.disabled) {
      throw createError({ statusCode: 400, message: 'Server is disabled' })
    }

    if (config.url) {
      throw createError({ statusCode: 501, message: 'SSE tool execution is not supported in GUI yet' })
    }

    const result = await callMcpTool(config, tool, args, workingDir || '')
    return result

  } catch (err: any) {
    if (err.statusCode) throw err
    throw createError({ statusCode: 500, message: `Failed to execute tool: ${err.message}` })
  }
})
