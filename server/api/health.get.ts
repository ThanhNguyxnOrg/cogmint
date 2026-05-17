export default defineEventHandler(() => {
  return {
    status: 'ok',
    service: 'cogmint',
    timestamp: new Date().toISOString(),
  }
})
