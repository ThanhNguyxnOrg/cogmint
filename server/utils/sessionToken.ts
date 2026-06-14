import { randomUUID } from 'node:crypto'

let apiToken: string | null = null

export function getApiToken(): string {
  if (!apiToken) {
    apiToken = randomUUID()
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
  const token = getCookie(cookieHeader, 'cogmint_token')
  if (!token || token !== getApiToken()) {
    console.warn(`[WebSocket Auth] Unauthorized connection attempt to ${peer.url || 'socket'}`)
    try {
      peer.close(1008, 'Unauthorized')
    } catch {
      // Socket might already be closed/closing
    }
    return false
  }
  return true
}
