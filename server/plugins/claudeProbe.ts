import { getClaudeInfo } from '../utils/claudeInfo'

export default defineNitroPlugin((nitroApp) => {
  // Probe Claude CLI on startup in the background
  getClaudeInfo(true)
    .then((info) => {
      console.log(`[Claude Probe Plugin] Successfully completed initial probe. Default model: ${info.appliedSettings?.applied?.model || 'unknown'}`)
    })
    .catch((err) => {
      console.error('[Claude Probe Plugin] Failed to complete initial probe:', err)
    })
})
