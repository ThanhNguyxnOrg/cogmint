import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

let apiToken: string | null = null

export function getApiToken(): string {
  if (apiToken) {
    return apiToken
  }

  // Try to read/write token from/to a file to share across dev worker threads
  const tokenFile = join(process.cwd(), '.nuxt', 'cogmint-token.txt')
  
  try {
    if (existsSync(tokenFile)) {
      const content = readFileSync(tokenFile, 'utf8').trim()
      if (content) {
        apiToken = content
        return apiToken
      }
    }
  } catch (err) {
    // Fallback if read fails
  }

  // Generate new token
  apiToken = randomUUID()

  try {
    // Ensure parent dir exists
    const dir = join(process.cwd(), '.nuxt')
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    writeFileSync(tokenFile, apiToken, 'utf8')
  } catch (err) {
    // If writing to .nuxt fails, try OS temp dir
    try {
      const fallbackFile = join(tmpdir(), 'cogmint-token.txt')
      if (existsSync(fallbackFile)) {
        const content = readFileSync(fallbackFile, 'utf8').trim()
        if (content) {
          apiToken = content
        } else {
          writeFileSync(fallbackFile, apiToken, 'utf8')
        }
      } else {
        writeFileSync(fallbackFile, apiToken, 'utf8')
      }
    } catch {}
  }

  return apiToken
}

export function verifyApiToken(token: string): boolean {
  return token === getApiToken()
}

function getCookie(cookieHeader: string, name: string): string | null {
  if (!cookieHeader) return null
  const match = cookieHeader.match(new RegExp('(^|;\\s*)' + name + '=([^;]*)'))
  return match ? decodeURIComponent(match[2]!) : null
}

/**
 * Verify WebSocket connection request using cookies
 */
export function authorizeWebSocket(peer: any): boolean {
  const cookieHeader = peer.headers?.['cookie'] || ''
  let token = getCookie(cookieHeader, 'cogmint_token')
  
  // Try parsing token from URL query params if cookie is missing
  if (!token && peer.url) {
    try {
      const url = new URL(peer.url, 'http://localhost')
      const tokenParam = url.searchParams.get('token')
      if (tokenParam) {
        token = tokenParam
      }
    } catch {
      // Ignore URL parse errors
    }
  }

  const expectedToken = getApiToken()
  if (!token || token !== expectedToken) {
    console.warn(`[WebSocket Auth] Unauthorized connection. Token: ${token || 'NONE'}, Expected: ${expectedToken}, Header: ${cookieHeader}`)
    console.warn(`[WebSocket Auth] Debug peer: url=${peer.url}, keys=${Object.keys(peer).join(',')}, requestKeys=${peer.request ? Object.keys(peer.request).join(',') : 'no_request'}`)
    try {
      peer.close(1008, 'Unauthorized')
    } catch {
      // Socket might already be closed/closing
    }
    return false
  }
  return true
}
