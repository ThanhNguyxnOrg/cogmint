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
  printPathHint(binDir)
  console.log('Run: cogmint --bootstrap --open')
}

main()
