import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { isWorkspaceTrusted } from '../../utils/workspaceTrust'

export default defineEventHandler(async (event) => {
  const { workingDir } = getQuery(event)

  const servers = []

  // Read global servers
  const globalPath = join(homedir(), '.claude.json')
  if (existsSync(globalPath)) {
    try {
      const raw = await readFile(globalPath, 'utf-8')
      const data = JSON.parse(raw)
      if (data.mcpServers) {
        for (const [name, config] of Object.entries(data.mcpServers)) {
          servers.push({
            name,
            ...(config as object),
            scope: 'global'
          })
        }
      }
    } catch (err) {
      console.error('Failed to parse global .claude.json', err)
    }
  }

  // Read project servers
  if (workingDir && typeof workingDir === 'string') {
    const projectPath = join(workingDir, '.mcp.json')
    if (existsSync(projectPath)) {
      const trusted = await isWorkspaceTrusted(workingDir)
      try {
        const raw = await readFile(projectPath, 'utf-8')
        const data = JSON.parse(raw)
        if (data.mcpServers) {
          for (const [name, config] of Object.entries(data.mcpServers)) {
            servers.push({
              name,
              ...(config as object),
              scope: 'project',
              untrusted: !trusted
            })
          }
        }
      } catch (err) {
        console.error('Failed to parse project .mcp.json', err)
      }
    }
  }

  // Sort alphabetically by name
  return servers.sort((a, b) => a.name.localeCompare(b.name))
})
