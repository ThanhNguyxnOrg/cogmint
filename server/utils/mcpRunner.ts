import { spawn, ChildProcess } from 'node:child_process'
import { getClaudeDir } from './claudeDir'

interface McpServerConfig {
  command: string
  args?: string[]
  env?: Record<string, string>
}

/**
 * Execute an MCP command and run a JSON-RPC interaction.
 */
function runJsonRpcSession(
  config: McpServerConfig,
  workingDir: string,
  method: string,
  params: any,
  timeoutMs = 8000
): Promise<any> {
  return new Promise((resolve, reject) => {
    const cwd = workingDir || getClaudeDir()
    const env = {
      ...process.env,
      ...(config.env || {})
    }

    console.log(`[mcpRunner] Spawning MCP server: ${config.command} ${config.args?.join(' ') || ''} in ${cwd}`)
    
    let child: ChildProcess
    try {
      child = spawn(config.command, config.args || [], {
        cwd,
        env,
        shell: process.platform === 'win32' // Use shell on Windows for PATH resolution (npx, etc.)
      })
    } catch (err: any) {
      return reject(new Error(`Failed to spawn MCP process: ${err.message}`))
    }

    let stdoutBuffer = ''
    let isFinished = false
    let currentId = 1

    const cleanup = () => {
      isFinished = true
      clearTimeout(timer)
      if (child && !child.killed) {
        child.kill('SIGTERM')
        // Give it a moment, then force kill if still running
        setTimeout(() => {
          if (!child.killed) child.kill('SIGKILL')
        }, 500)
      }
    }

    const timer = setTimeout(() => {
      cleanup()
      reject(new Error(`MCP server execution timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    // Write a request to stdin
    const sendRequest = (req: any) => {
      if (child.stdin && child.stdin.writable) {
        const payload = JSON.stringify(req) + '\n'
        child.stdin.write(payload)
      }
    }

    child.on('error', (err) => {
      cleanup()
      reject(new Error(`MCP server error: ${err.message}`))
    })

    child.on('exit', (code) => {
      if (!isFinished) {
        cleanup()
        reject(new Error(`MCP server exited prematurely with code ${code}`))
      }
    })

    // Listen to stderr for debugging
    child.stderr?.on('data', (data) => {
      console.warn(`[mcpRunner stderr] ${data.toString().trim()}`)
    })

    // Listen to stdout and parse JSON-RPC messages
    child.stdout?.on('data', (data) => {
      if (isFinished) return
      stdoutBuffer += data.toString()

      // Parse complete JSON-RPC messages from buffer
      // MCP servers usually send messages terminated by newlines
      let newlineIdx: number
      while ((newlineIdx = stdoutBuffer.indexOf('\n')) !== -1) {
        const line = stdoutBuffer.slice(0, newlineIdx).trim()
        stdoutBuffer = stdoutBuffer.slice(newlineIdx + 1)

        if (line) {
          try {
            const message = JSON.parse(line)
            handleMessage(message)
          } catch (e) {
            // If it's not valid JSON yet, we could be getting raw logs or partial output. Let's ignore or wait.
            console.debug('[mcpRunner] Ignored non-JSON line:', line)
          }
        }
      }
    })

    const handleMessage = (msg: any) => {
      if (isFinished) return

      // Check if it's the response to our current request
      if (msg.id === currentId) {
        if (msg.error) {
          cleanup()
          reject(new Error(`MCP JSON-RPC Error: ${msg.error.message || JSON.stringify(msg.error)}`))
          return
        }

        if (currentId === 1) {
          // Initialize response received! Send initialized notification and our target request.
          sendRequest({
            jsonrpc: '2.0',
            method: 'notifications/initialized',
            params: {}
          })

          currentId = 2
          sendRequest({
            jsonrpc: '2.0',
            id: currentId,
            method,
            params
          })
        } else if (currentId === 2) {
          // Target request response received!
          cleanup()
          resolve(msg.result)
        }
      }
    }

    // Start by sending initialize request
    sendRequest({
      jsonrpc: '2.0',
      id: currentId,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'cogmint-runner',
          version: '1.0.0'
        }
      }
    })
  })
}

/**
 * List all tools defined by a local stdio MCP server
 */
export async function listMcpTools(config: McpServerConfig, workingDir: string): Promise<any[]> {
  try {
    const result = await runJsonRpcSession(config, workingDir, 'tools/list', {})
    return result.tools || []
  } catch (err: any) {
    console.error(`[mcpRunner] Failed to list tools:`, err.message)
    throw err
  }
}

/**
 * Call a specific tool on a local stdio MCP server
 */
export async function callMcpTool(
  config: McpServerConfig,
  toolName: string,
  args: any,
  workingDir: string
): Promise<any> {
  try {
    const result = await runJsonRpcSession(config, workingDir, 'tools/call', {
      name: toolName,
      arguments: args || {}
    })
    return result
  } catch (err: any) {
    console.error(`[mcpRunner] Failed to call tool ${toolName}:`, err.message)
    throw err
  }
}
