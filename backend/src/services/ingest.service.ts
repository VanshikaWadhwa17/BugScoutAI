import crypto from 'crypto';
import { PoolClient } from 'pg';
import { detectIssues } from './issueDetector';

export const EVENT_TYPES = {
  CLICK: 'click',
  PAGE_VIEW: 'page_view'
} as const;

export type EventType = typeof EVENT_TYPES[keyof typeof EVENT_TYPES];

export interface IngestPayload {
  session_id: string;
  user_id?: string;
  user_email?: string;
  events: Array<{
    type: string;
    timestamp: number;
    meta?: {
      selector?: string;
      url?: string;
      [key: string]: any;
    };
  }>;
}

export interface IngestResult {
  success: boolean;
  eventsSaved: number;
  message?: string;
}

function eventId(sessionId: string, event: { type: string; timestamp: number }, index: number): string {
  return crypto
    .createHash('sha1')
    .update(sessionId + String(event.timestamp) + event.type + String(index))
    .digest('hex');
}


/**
 * Validate API key and return project ID
 */
export async function validateApiKey(
  client: PoolClient,
  apiKey: string
): Promise<number | null> {
  const result = await client.query(
    'SELECT id FROM projects WHERE api_key = $1',
    [apiKey]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0].id;
}

/**
 * Ensure session exists, create if not; update summary columns and optional user identity
 */
export async function ensureSession(
  client: PoolClient,
  projectId: number,
  sessionId: string,
  firstEventTimestamp: number,
  lastEventTimestamp: number,
  clickDelta: number,
  pageViewDelta: number,
  userId?: string | null,
  userEmail?: string | null
): Promise<void> {
  const tsFirst = firstEventTimestamp / 1000;
  const tsLast = lastEventTimestamp / 1000;

  const result = await client.query(
    `SELECT session_id, first_event_at FROM sessions WHERE session_id = $1`,
    [sessionId]
  );

  if (result.rows.length === 0) {
    await client.query(
      `INSERT INTO sessions (
        session_id, project_id, started_at, last_event_at,
        click_count, page_view_count, issue_count, first_event_at, user_id, user_email
      ) VALUES ($1, $2, to_timestamp($3), to_timestamp($4), $5, $6, 0, to_timestamp($3), $7, $8)`,
      [sessionId, projectId, tsFirst, tsLast, clickDelta, pageViewDelta, userId ?? null, userEmail ?? null]
    );
  } else {
    const updates: string[] = [
      'last_event_at = to_timestamp($1)',
      'click_count = click_count + $2',
      'page_view_count = page_view_count + $3'
    ];
    const values: any[] = [tsLast, clickDelta, pageViewDelta];
    let paramIndex = 4;
    if (userId !== undefined) {
      updates.push(`user_id = $${paramIndex}`);
      values.push(userId);
      paramIndex++;
    }
    if (userEmail !== undefined) {
      updates.push(`user_email = $${paramIndex}`);
      values.push(userEmail);
      paramIndex++;
    }
    values.push(sessionId);
    await client.query(
      `UPDATE sessions SET ${updates.join(', ')} WHERE session_id = $${paramIndex}`,
      values
    );
  }
}

/**
 * Save events to database (idempotent by event_id). Accepts all event types (click, tap, page_view, console, navigation, etc.).
 */
export async function saveEvents(
  client: PoolClient,
  projectId: number,
  sessionId: string,
  events: IngestPayload['events'],
  userId?: string | null,
  userEmail?: string | null
): Promise<number> {
  if (events.length === 0) return 0;

  const timestamps = events.map(e => e.timestamp);
  const earliest = Math.min(...timestamps);
  const latest = Math.max(...timestamps);
  const clickDelta = events.filter(e => e.type === EVENT_TYPES.CLICK || e.type === 'tap').length;
  const pageViewDelta = events.filter(e => e.type === EVENT_TYPES.PAGE_VIEW || e.type === 'pageview').length;

  await ensureSession(
    client,
    projectId,
    sessionId,
    earliest,
    latest,
    clickDelta,
    pageViewDelta,
    userId,
    userEmail
  );

  const insertResults = await Promise.all(events.map((event, index) => {
    const eid = eventId(sessionId, event, index);
    return client.query(
      `INSERT INTO events (project_id, session_id, event_id, type, payload, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6::BIGINT)
       ON CONFLICT (project_id, event_id) DO NOTHING`,
      [
        projectId,
        sessionId,
        eid,
        event.type,
        JSON.stringify({ meta: event.meta || {} }),
        event.timestamp
      ]
    );
  }));
  const saved = insertResults.filter(r => r.rowCount && r.rowCount > 0).length;

  return saved;
}

/**
 * Sync session.issue_count from issues table
 */
async function syncSessionIssueCount(
  client: PoolClient,
  sessionId: string
): Promise<void> {
  await client.query(
    `UPDATE sessions SET issue_count = (
      SELECT COUNT(*) FROM issues WHERE session_id = $1
    ) WHERE session_id = $1`,
    [sessionId]
  );
}

/**
 * Main ingestion function
 */
export async function ingestEvents(
  client: PoolClient,
  apiKey: string,
  payload: IngestPayload
): Promise<IngestResult> {
  const projectId = await validateApiKey(client, apiKey);
  if (!projectId) {
    return {
      success: false,
      eventsSaved: 0,
      message: 'Invalid API key'
    };
  }

  if (!payload.session_id || !payload.events || !Array.isArray(payload.events)) {
    return {
      success: false,
      eventsSaved: 0,
      message: 'Invalid payload: session_id and events array required'
    };
  }

  const eventsSaved = await saveEvents(
    client,
    projectId,
    payload.session_id,
    payload.events,
    payload.user_id,
    payload.user_email
  );

  await detectIssues(client, projectId, payload.session_id, payload.events);
  await syncSessionIssueCount(client, payload.session_id);

  return {
    success: true,
    eventsSaved,
    message: `Saved ${eventsSaved} events`
  };
}
