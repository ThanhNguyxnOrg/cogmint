#!/usr/bin/env node

import { existsSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs'
import { homedir, platform, arch } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const REPO_OWNER = 'ThanhNguyxnOrg'
const REPO_NAME = 'cogmint'
const API_BASE = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = resolve(__dirname, '..', '..')
const launcherEntry = join(projectRoot, 'bin', 'start.mjs')

function requestJson(url) {
  const result = spawnSync('curl', ['-sL', '-H', 'Accept: application/vnd.github+json', url], { encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(`Failed request: ${url}`)
  }
  return JSON.parse(result.stdout)
}

function detectTarget() {
  const os = platform()
  const cpu = arch()

  if (os === 'win32') return { os: 'windows', ext: 'zip', cpu: cpu === 'x64' ? 'x64' : cpu }
  if (os === 'darwin') return { os: 'macos', ext: 'tar.gz', cpu: cpu === 'arm64' ? 'arm64' : 'x64' }
  if (os === 'linux') return { os: 'linux', ext: 'tar.gz', cpu: cpu === 'arm64' ? 'arm64' : 'x64' }

  throw new Error(`Unsupported platform: ${os}/${cpu}`)
}

function ensureBinDir() {
  const dir = join(homedir(), '.cogmint', 'bin')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function toPosixPath(path) {
  return path.replace(/\\/g, '/')
}

function installWindowsWrapper(binDir, entry) {
  const target = join(binDir, 'cogmint.cmd')
  const cmd = `@echo off\r\nnode "${entry}" %*\r\n`
  writeFileSync(target, cmd, 'utf8')
  return target
}

function installPosixWrapper(binDir, entry) {
  const target = join(binDir, 'cogmint')
  const sh = `#!/usr/bin/env bash\nnode "${toPosixPath(entry)}" "$@"\n`
  writeFileSync(target, sh, 'utf8')
  chmodSync(target, 0o755)
  return target
}

function installWrapper(binDir, entry) {
  if (platform() === 'win32') {
    return installWindowsWrapper(binDir, entry)
  }
  return installPosixWrapper(binDir, entry)
}

function addToWindowsPath(binDir) {
  try {
    const psCommand = `
      $binDir = "${binDir.replace(/\\/g, '\\\\')}"
      $currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
      if ($currentPath.Split(';') -notcontains $binDir) {
        [Environment]::SetEnvironmentVariable("PATH", $currentPath + ";" + $binDir, "User")
        Write-Output "SUCCESS"
      } else {
        Write-Output "ALREADY_EXISTS"
      }
    `.trim().replace(/\s+/g, ' ')
    
    const result = spawnSync('powershell', ['-NoProfile', '-Command', psCommand], { encoding: 'utf8' })
    const out = result.stdout ? result.stdout.trim() : ''
    if (out === 'SUCCESS') {
      console.log('🎉 Automatically added Cogmint bin directory to your User PATH variable!')
    } else if (out === 'ALREADY_EXISTS') {
      console.log('✓ Cogmint bin directory is already in your PATH.')
    }
  } catch (err) {
    console.warn('Could not automatically update PATH:', err.message)
    console.log(`Please add this path manually to your user PATH: ${binDir}`)
  }
}

function installClaudeCodeCommand() {
  try {
    const claudeCommandsDir = join(homedir(), '.claude', 'commands')
    if (!existsSync(claudeCommandsDir)) {
      mkdirSync(claudeCommandsDir, { recursive: true })
    }
    const commandFile = join(claudeCommandsDir, 'cogmint.md')
    const content = `---
name: cogmint
description: Start the Cogmint Visual Control Plane dashboard in your browser
---
Launching Cogmint Visual Control Plane...

Run the following command to start Cogmint:
\`\`\`bash
cogmint --open
\`\`\`
`
    writeFileSync(commandFile, content, 'utf8')
    console.log(`✓ Installed Claude Code slash command at: ${commandFile}`)
    console.log('👉 You can now run "/cogmint" inside Claude Code to launch the visual interface!')
  } catch (err) {
    console.warn('Failed to install Claude Code slash command:', err.message)
  }
}

function printPathHint(binDir) {
  if (platform() === 'win32') {
    console.log(`Add to PATH if needed: ${binDir}`)
  } else {
    console.log(`Add to PATH if needed: export PATH="${binDir}:$PATH"`)
  }
}

function main() {
  console.log('Installing COGMINT launcher...')

  const target = detectTarget()
  console.log(`Detected: ${target.os}/${target.cpu}`)

  // Best-effort release metadata check (future artifact bootstrap)
  try {
    const latest = requestJson(`${API_BASE}/releases/latest`)
    if (latest && typeof latest.tag_name === 'string' && latest.tag_name.length > 0) {
      console.log(`Latest release: ${latest.tag_name}`)
    } else {
      console.warn('Could not determine latest release tag; continuing with local launcher install.')
    }
  } catch (error) {
    console.warn(`Release metadata lookup failed: ${error instanceof Error ? error.message : String(error)}`)
    console.warn('Continuing with local launcher install.')
  }

  if (!existsSync(launcherEntry)) {
    throw new Error(`Launcher entry not found: ${launcherEntry}`)
  }

  const binDir = ensureBinDir()
  const wrapper = installWrapper(binDir, launcherEntry)

  console.log(`Installed wrapper: ${wrapper}`)
  
  if (platform() === 'win32') {
    addToWindowsPath(binDir)
  } else {
    printPathHint(binDir)
  }

  installClaudeCodeCommand()

  console.log('\nRun: cogmint --bootstrap --open')
}

main()
