import { detectSdkSession, loadSdkSessionMessages } from '../../../utils/sdkSessionStorage'
import { loadSessionHistory } from '../../../utils/cliSession'
import { getModelPricing } from '../../../utils/models'

export default defineEventHandler(async (event) => {
  const sessionId = getRouterParam(event, 'sessionId')
  const query = getQuery(event)
  const format = (query.format as string) || 'markdown'

  if (!sessionId) {
    throw createError({
      statusCode: 400,
      message: 'Session ID is required',
    })
  }

  try {
    // 1. Try to load CLI session log
    let cliHistory: any = null
    try {
      cliHistory = await loadSessionHistory(sessionId)
    } catch {
      // Not a CLI session or CLI session not saved to disk yet
    }

    if (cliHistory) {
      if (format === 'json') {
        setHeader(event, 'Content-Type', 'application/json')
        setHeader(event, 'Content-Disposition', `attachment; filename="cli-session-${sessionId}.json"`)
        return JSON.stringify(cliHistory, null, 2)
      }

      // Format as Markdown
      const mdLines = [
        '---',
        `id: "${cliHistory.id}"`,
        `type: "cli"`,
        `agentSlug: "${cliHistory.agentSlug || ''}"`,
        `workingDir: "${cliHistory.workingDir || ''}"`,
        `createdAt: "${cliHistory.createdAt || ''}"`,
        `lastActivity: "${cliHistory.lastActivity || ''}"`,
        `inputTokens: ${cliHistory.tokenUsage?.input || 0}`,
        `outputTokens: ${cliHistory.tokenUsage?.output || 0}`,
        `cachedTokens: ${cliHistory.tokenUsage?.cached || 0}`,
        `estimatedCost: ${cliHistory.cost || 0}`,
        '---',
        '',
        `# COGMINT CLI Session: ${cliHistory.id}`,
        '',
        '## Execution Metadata',
        `- **Agent**: \`${cliHistory.agentSlug || 'Default CLI'}\``,
        `- **Directory**: \`${cliHistory.workingDir}\``,
        `- **Created At**: ${new Date(cliHistory.createdAt).toLocaleString()}`,
        `- **Token Cost**: $${cliHistory.cost ? cliHistory.cost.toFixed(4) : '0.0000'} (In: ${cliHistory.tokenUsage?.input || 0} / Out: ${cliHistory.tokenUsage?.output || 0})`,
        '',
        '## Terminal Log Output',
        '```ansi',
        cliHistory.output || '',
        '```',
        ''
      ]

      setHeader(event, 'Content-Type', 'text/markdown; charset=utf-8')
      setHeader(event, 'Content-Disposition', `attachment; filename="cli-session-${sessionId}.md"`)
      return mdLines.join('\n')
    }

    // 2. Try to load SDK chat session log
    let projectName = await detectSdkSession(sessionId)
    if (!projectName) {
      // Try projects directory scan to match
      throw createError({
        statusCode: 404,
        message: `Session ${sessionId} not found on local disk`,
      })
    }

    const { messages } = await loadSdkSessionMessages(projectName, sessionId, { limit: null })

    if (messages.length === 0) {
      throw createError({
        statusCode: 404,
        message: `Session ${sessionId} exists but has no message logs`,
      })
    }

    if (format === 'json') {
      setHeader(event, 'Content-Type', 'application/json')
      setHeader(event, 'Content-Disposition', `attachment; filename="chat-session-${sessionId}.json"`)
      return JSON.stringify(messages, null, 2)
    }

    // Calculate totals for metadata header
    let totalInput = 0
    let totalOutput = 0
    let totalCached = 0
    for (const msg of messages) {
      const msgAny = msg as any
      if (msgAny.tokens) {
        totalInput += msgAny.tokens.input || 0
        totalOutput += msgAny.tokens.output || 0
        totalCached += msgAny.tokens.cached || 0
      }
    }

    const pricing = getModelPricing('claude-sonnet-4')
    const totalCost = (totalInput / 1_000_000) * pricing.input +
                      (totalOutput / 1_000_000) * pricing.output +
                      (totalCached / 1_000_000) * pricing.cached

    // Format as Markdown
    const firstMsg = messages[0]!
    const agentSlug = firstMsg.metadata?.agentSlug || ''
    const workingDir = firstMsg.metadata?.workingDir || ''
    
    const mdLines = [
      '---',
      `id: "${sessionId}"`,
      `type: "chat"`,
      `agentSlug: "${agentSlug}"`,
      `workingDir: "${workingDir}"`,
      `inputTokens: ${totalInput}`,
      `outputTokens: ${totalOutput}`,
      `cachedTokens: ${totalCached}`,
      `estimatedCost: ${Number(totalCost.toFixed(4))}`,
      '---',
      '',
      `# COGMINT Chat Session: ${sessionId}`,
      '',
      '## Chat Metadata',
      `- **Agent Slug**: \`${agentSlug || 'Default Claude'}\``,
      `- **Working Directory**: \`${workingDir || 'System default'}\``,
      `- **Total Tokens**: ${totalInput + totalOutput} (Input: ${totalInput} / Output: ${totalOutput} / Cached: ${totalCached})`,
      `- **Estimated Cost**: $${totalCost.toFixed(4)} USD`,
      '',
      '## Conversation Log',
      ''
    ]

    for (const msg of messages) {
      const roleName = msg.role === 'user' ? '👤 User' : '🤖 Claude'
      const timestamp = msg.timestamp ? new Date(msg.timestamp).toLocaleString() : 'N/A'
      
      mdLines.push(`### ${roleName} *(${timestamp})*`)
      mdLines.push('')
      mdLines.push(msg.content || '')
      mdLines.push('')
      
      if (msg.images && msg.images.length > 0) {
        mdLines.push('**Embedded Images:**')
        msg.images.forEach((img: string, idx: number) => {
          mdLines.push(`- Image [${idx + 1}] (${img.slice(0, 40)}...)`)
        })
        mdLines.push('')
      }

      mdLines.push('---')
      mdLines.push('')
    }

    setHeader(event, 'Content-Type', 'text/markdown; charset=utf-8')
    setHeader(event, 'Content-Disposition', `attachment; filename="chat-session-${sessionId}.md"`)
    return mdLines.join('\n')
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to export session logs',
    })
  }
})
