import { getClaudeInfo } from '../../utils/claudeInfo'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const bypassCache = query.refresh === 'true'
  const info = await getClaudeInfo(bypassCache)
  return info
})
