import { getSessionContextUsage } from '../../utils/claudeSdk'

export default defineEventHandler(async (event) => {
  const queryParams = getQuery(event)
  const sessionId = queryParams.sessionId as string

  if (!sessionId) {
    throw createError({
      statusCode: 400,
      message: 'Session ID is required',
    })
  }

  if (sessionId.startsWith('new-session-') || sessionId.startsWith('local-')) {
    return null
  }

  const usage = await getSessionContextUsage(sessionId)
  return usage
})
