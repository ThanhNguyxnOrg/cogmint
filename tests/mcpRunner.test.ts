import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { listMcpTools, callMcpTool } from '../server/utils/mcpRunner'

describe('Stdio MCP JSON-RPC Runner', () => {
  let tempDir: string
  let mockServerScript: string

  beforeAll(async () => {
    // Create isolated directory and write mock stdio server script
    tempDir = await mkdtemp(join(tmpdir(), 'cogmint-mcp-test-'))
    mockServerScript = join(tempDir, 'mockServer.js')

    const mockServerCode = `
      let buffer = '';
      process.stdin.on('data', (data) => {
        buffer += data.toString();
        let newlineIdx;
        while ((newlineIdx = buffer.indexOf('\\n')) !== -1) {
          const line = buffer.slice(0, newlineIdx).trim();
          buffer = buffer.slice(newlineIdx + 1);
          if (!line) continue;
          try {
            const msg = JSON.parse(line);
            if (msg.method === 'initialize') {
              process.stdout.write(JSON.stringify({
                jsonrpc: '2.0',
                id: msg.id,
                result: {
                  protocolVersion: '2024-11-05',
                  capabilities: {},
                  serverInfo: { name: 'mock-mcp-server', version: '1.0.0' }
                }
              }) + '\\n');
            } else if (msg.method === 'tools/list') {
              process.stdout.write(JSON.stringify({
                jsonrpc: '2.0',
                id: msg.id,
                result: {
                  tools: [
                    {
                      name: 'greet',
                      description: 'Greets the user by name',
                      inputSchema: {
                        type: 'object',
                        properties: { name: { type: 'string' } },
                        required: ['name']
                      }
                    }
                  ]
                }
              }) + '\\n');
            } else if (msg.method === 'tools/call') {
              const name = msg.params.arguments?.name || 'World';
              process.stdout.write(JSON.stringify({
                jsonrpc: '2.0',
                id: msg.id,
                result: {
                  content: [{ type: 'text', text: \`Hello, \${name}!\` }]
                }
              }) + '\\n');
            }
          } catch (e) {
            process.stderr.write('Error: ' + e.message + '\\n');
          }
        }
      });
    `
    await writeFile(mockServerScript, mockServerCode, 'utf8')
  })

  afterAll(async () => {
    // Wait briefly for spawned node process to terminate fully and release file handles
    await new Promise((resolve) => setTimeout(resolve, 300))
    if (existsSync(tempDir)) {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('successfully lists tools from stdio MCP server', async () => {
    const config = {
      command: 'node',
      args: [mockServerScript]
    }
    const tools = await listMcpTools(config, tempDir)
    expect(tools.length).toBe(1)
    expect(tools[0].name).toBe('greet')
    expect(tools[0].description).toBe('Greets the user by name')
  })

  test('successfully calls a tool on stdio MCP server', async () => {
    const config = {
      command: 'node',
      args: [mockServerScript]
    }
    const result = await callMcpTool(config, 'greet', { name: 'Gemini' }, tempDir)
    expect(result).toBeDefined()
    expect(result.content).toBeDefined()
    expect(result.content[0].text).toBe('Hello, Gemini!')
  })
})
