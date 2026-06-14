import { getRequestHeader, setCookie } from 'h3'
import { getApiToken } from '../utils/sessionToken'

export default defineEventHandler((event) => {
  const host = getRequestHeader(event, 'host') || ''
  const origin = getRequestHeader(event, 'origin') || ''
  const referer = getRequestHeader(event, 'referer') || ''

  // 1. Host Validation (prevents DNS Rebinding)
  // Ensure the host is either localhost, 127.0.0.1, [::1] (IPv6 loopback), or starts with them
  const isLocalhost = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host)
  if (!isLocalhost && host) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: Invalid Host header'
    })
  }

  // 2. Cross-Origin Requests Check (prevents CSRF / CORS extraction from external sites)
  if (origin) {
    const isLocalOrigin = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(origin)
    if (!isLocalOrigin) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden: Cross-origin requests blocked'
      })
    }
  }

  // 3. Referer Validation (if present, must reside on localhost)
  if (referer) {
    try {
      const url = new URL(referer)
      const isLocalReferer = /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(url.hostname)
      if (!isLocalReferer) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Forbidden: Cross-origin referer blocked'
        })
      }
    } catch {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request: Invalid Referer header'
      })
    }
  }

  // 4. Set Session Cookie for Local Authentications
  setCookie(event, 'cogmint_token', getApiToken(), {
    httpOnly: false, // Client-accessible to verify connection
    sameSite: 'strict',
    path: '/'
  })
})
