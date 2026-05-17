#!/usr/bin/env node

import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve, dirname } from 'node:path'
import { existsSync } from 'node:fs'
import { execSync, spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { platform } from 'node:os'
import { request } from 'node:http'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const outputServer = resolve(root, '.output', 'server', 'index.mjs')

function parseArgs(argv) {
  const args = {
    bootstrap: false,
    open: false,
    port: undefined,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]

    if (value === '--bootstrap') {
      args.bootstrap = true
      continue
    }

    if (value === '--open') {
      args.open = true
      continue
    }

    if (value === '--port') {
      const candidate = argv[index + 1]
      if (!candidate) {
        throw new Error('Missing value for --port')
      }

      const parsed = Number.parseInt(candidate, 10)
      if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
        throw new Error(`Invalid --port value: ${candidate}`)
      }

      args.port = parsed
      index += 1
    }
  }

  return args
}

function checkPortAvailable(port) {
  return new Promise((resolveAvailability) => {
    const server = createServer()

    server.once('error', () => resolveAvailability(false))
    server.once('listening', () => {
      server.close(() => resolveAvailability(true))
    })

    server.listen(port, '127.0.0.1')
  })
}

async function findAvailablePort(preferredPort) {
  const startPort = preferredPort ?? 3000
  const maxAttempts = 30

  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const candidate = startPort + offset
    const available = await checkPortAvailable(candidate)
    if (available) {
      return candidate
    }
  }

  throw new Error(`Unable to find available port from ${startPort} to ${startPort + maxAttempts - 1}`)
}

function openUrl(url) {
  const os = platform()

  if (os === 'win32') {
    spawn('cmd', ['/c', 'start', '""', url], { detached: true, stdio: 'ignore' }).unref()
    return
  }

  if (os === 'darwin') {
    spawn('open', [url], { detached: true, stdio: 'ignore' }).unref()
    return
  }

  spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref()
}

function waitForHealth(url, attempts = 30, delayMs = 500) {
  return new Promise((resolveHealth, rejectHealth) => {
    let remaining = attempts

    const check = () => {
      const req = request(`${url}/api/health`, { method: 'GET' }, (res) => {
        const status = res.statusCode ?? 0
        res.resume()

        // Readiness check should confirm server responsiveness,
        // even when a dedicated health endpoint is not yet present.
        if (status >= 200 && status < 500) {
          resolveHealth()
          return
        }

        if (remaining <= 0) {
          rejectHealth(new Error(`Health check returned status ${status}`))
          return
        }

        remaining -= 1
        setTimeout(check, delayMs)
      })

      req.on('error', () => {
        if (remaining <= 0) {
          rejectHealth(new Error('Health endpoint did not become ready in time'))
          return
        }

        remaining -= 1
        setTimeout(check, delayMs)
      })

      req.end()
    }

    check()
  })
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (!existsSync(outputServer)) {
    console.log('Building COGMINT...')
    execSync('npx nuxi build', { cwd: root, stdio: 'inherit' })
  }

  const preferredPort = args.port ?? (process.env.PORT ? Number.parseInt(process.env.PORT, 10) : undefined)
  const port = await findAvailablePort(Number.isInteger(preferredPort) ? preferredPort : undefined)

  if (args.bootstrap) {
    console.log('Bootstrap mode: ensuring COGMINT runtime is ready...')
  }

  process.env.PORT = String(port)
  process.env.HOST = process.env.HOST || '0.0.0.0'

  const url = `http://localhost:${port}`
  console.log(`Starting COGMINT on ${url}`)

  await import(pathToFileURL(outputServer).href)

  await waitForHealth(url)
  console.log(`COGMINT is healthy at ${url}`)

  if (args.open) {
    try {
      openUrl(url)
      console.log(`Opening browser: ${url}`)
    } catch (error) {
      console.warn(`Could not open browser automatically: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

main().catch((error) => {
  console.error(`COGMINT launcher failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
