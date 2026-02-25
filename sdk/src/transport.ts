import { EventPayload } from './types'
import { getSessionId } from './session'

let buffer: EventPayload[] = []
let config: any

export function initTransport(cfg: any) {
  config = cfg
  setInterval(flush, cfg.flushInterval || 5000)
}

export function enqueue(event: EventPayload) {
  buffer.push(event)
}

function flush() {
  if (!buffer.length) return

  const payload = {
    session_id: getSessionId(),
    events: buffer.splice(0, buffer.length),
    api_key: config.apiKey
  }

  const url = `${config.apiHost}/ingest`

  // Use fetch so CORS and X-API-Key work reliably; sendBeacon can't set headers and has CORS quirks
  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': config.apiKey
    },
    body: JSON.stringify(payload)
  }).catch(() => {
    // silent fail (retry next flush)
    buffer.unshift(...payload.events)
  })
}
