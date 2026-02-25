import { initTransport } from './transport'
import { startCapture } from './capture'

export function init(config: any) {
  if (!config.apiKey) {
    console.warn('[bugScoutAI] apiKey is required')
    return
  }

  config.apiHost ||= 'http://localhost:3000'

  initTransport(config)
  startCapture()
}
