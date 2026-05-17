import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import path from 'node:path'
import os from 'node:os'

export default defineEventHandler(() => {
  const possiblePaths = process.platform === 'win32'
    ? [
        'C:\\Program Files\\Claude\\claude.exe',
        'C:\\Program Files\\Anthropic\\Claude\\claude.exe',
        path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Claude', 'claude.exe'),
      ]
    : [
        '/opt/homebrew/bin/claude',
        '/usr/local/bin/claude',
        '/usr/bin/claude',
      ]

  const results = possiblePaths.map((candidatePath) => ({
    path: candidatePath,
    exists: existsSync(candidatePath),
    accessible: checkAccess(candidatePath),
  }))

  const executableNames = process.platform === 'win32'
    ? ['claude.exe', 'claude.cmd', 'claude.bat', 'claude']
    : ['claude']

  const pathSearch = process.env.PATH
    ? process.env.PATH.split(path.delimiter).flatMap((dir) =>
        executableNames
          .map((name) => {
            const claudePath = join(dir, name)
            return {
              path: claudePath,
              exists: existsSync(claudePath),
              accessible: checkAccess(claudePath),
            }
          })
          .filter(r => r.exists)
      )
    : []

  const commandProbe = process.platform === 'win32'
    ? { command: 'where', args: ['claude'] }
    : { command: 'which', args: ['claude'] }
  const commandResult = spawnSync(commandProbe.command, commandProbe.args, { encoding: 'utf8' })
  const commandPath = commandResult.status === 0
    ? commandResult.stdout.split(/\r?\n/).map(line => line.trim()).find(Boolean) || null
    : null

  return {
    possiblePaths: results,
    pathEnvironment: process.env.PATH,
    pathSearch: pathSearch.slice(0, 8),
    commandProbe: commandPath,
    claudeCliPathEnv: process.env.CLAUDE_CLI_PATH || null,
    recommendation: results.find(r => r.accessible)?.path || pathSearch.find(r => r.accessible)?.path || commandPath,
  }
})

function checkAccess(filePath: string): boolean {
  try {
    const fs = require('node:fs')
    fs.accessSync(filePath, fs.constants.F_OK)
    if (process.platform !== 'win32') {
      fs.accessSync(filePath, fs.constants.X_OK)
    }
    return true
  } catch {
    return false
  }
}
