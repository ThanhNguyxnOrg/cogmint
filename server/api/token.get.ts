import { defineEventHandler } from 'h3'
import { getApiToken } from '../utils/sessionToken'

export default defineEventHandler(() => {
  return {
    token: getApiToken()
  }
})
