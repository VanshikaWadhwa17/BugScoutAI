export type BugScoutAIConfig = {
  apiKey: string
  apiHost?: string
  flushInterval?: number
}

export type EventPayload = {
  type: string
  timestamp: number
  meta?: Record<string, any>
}
