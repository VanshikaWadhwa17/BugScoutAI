import { PoolClient } from 'pg';

export type IssueType = 'rage_click' | 'dead_click';

export type IssueSeverity = 'low' | 'medium' | 'high';

export interface Event {
  type: string;
  timestamp: number;
  meta?: {
    selector?: string;
    [key: string]: any;
  };
}

function severityFromClickCount(clickCount: number): IssueSeverity {
  if (clickCount >= 8) return 'high';
  if (clickCount >= 4) return 'medium';
  return 'low';
}

/**
 * Detect rage clicks: same element, ≥4 clicks, ≤2 seconds.
 * Severity by click count; group by (project_id, session_id, issue_type, element) with occurrence_count.
 */
export async function detectRageClicks(
  client: PoolClient,
  projectId: number,
  sessionId: string,
  events: Event[]
): Promise<void> {
  const clickEvents = events.filter(e => e.type === 'click' || e.type === 'tap');

  const clicksBySelector: { [selector: string]: Event[] } = {};

  for (const event of clickEvents) {
    const selector = event.meta?.selector || 'unknown';
    if (!clicksBySelector[selector]) {
      clicksBySelector[selector] = [];
    }
    clicksBySelector[selector].push(event);
  }

  for (const [selector, clicks] of Object.entries(clicksBySelector)) {
    if (clicks.length < 4) continue;

    clicks.sort((a, b) => a.timestamp - b.timestamp);

    for (let i = 0; i <= clicks.length - 4; i++) {
      const firstClick = clicks[i];
      const fourthClick = clicks[i + 3];
      const timeDiff = (fourthClick.timestamp - firstClick.timestamp) / 1000;

      if (timeDiff <= 2) {
        const clickCount = clicks.length;
        const severity = severityFromClickCount(clickCount);
        await client.query(
          `INSERT INTO issues (
            project_id, session_id, issue_type, element, severity,
            occurrence_count, first_seen_at, last_seen_at
          ) VALUES ($1, $2, $3, $4, $5, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT (project_id, session_id, issue_type, element) DO UPDATE SET
            occurrence_count = issues.occurrence_count + 1,
            last_seen_at = CURRENT_TIMESTAMP,
            severity = $5`,
          [projectId, sessionId, 'rage_click', selector, severity]
        );
        break;
      }
    }
  }
}

/**
 * Detect dead clicks: click with no navigation/page_view or mutation within 1s.
 */
export async function detectDeadClicks(
  client: PoolClient,
  projectId: number,
  sessionId: string,
  events: Event[]
): Promise<void> {
  const clickEvents = events.filter(e => e.type === 'click' || e.type === 'tap');
  const navigationEvents = events.filter(e =>
    e.type === 'navigation' || e.type === 'page_view' || e.type === 'pageview' || e.type === 'route_change'
  );
  const mutationEvents = events.filter(e =>
    e.type === 'mutation' || e.type === 'dom_change'
  );

  const navigationTimestamps = new Set(navigationEvents.map(e => e.timestamp));
  const mutationTimestamps = new Set(mutationEvents.map(e => e.timestamp));

  for (const clickEvent of clickEvents) {
    const clickTime = clickEvent.timestamp;
    const selector = clickEvent.meta?.selector || 'unknown';

    let hasResponse = false;

    for (const navTime of navigationTimestamps) {
      const timeDiff = (navTime - clickTime) / 1000;
      if (timeDiff > 0 && timeDiff <= 1) {
        hasResponse = true;
        break;
      }
    }

    if (!hasResponse) {
      for (const mutTime of mutationTimestamps) {
        const timeDiff = (mutTime - clickTime) / 1000;
        if (timeDiff > 0 && timeDiff <= 1) {
          hasResponse = true;
          break;
        }
      }
    }

    if (!hasResponse) {
      await client.query(
        `INSERT INTO issues (
          project_id, session_id, issue_type, element, severity,
          occurrence_count, first_seen_at, last_seen_at
        ) VALUES ($1, $2, $3, $4, 'low', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (project_id, session_id, issue_type, element) DO UPDATE SET
          occurrence_count = issues.occurrence_count + 1,
          last_seen_at = CURRENT_TIMESTAMP`,
        [projectId, sessionId, 'dead_click', selector]
      );
    }
  }
}

/**
 * Run all issue detection rules
 */
export async function detectIssues(
  client: PoolClient,
  projectId: number,
  sessionId: string,
  events: Event[]
): Promise<void> {
  const result = await client.query(
    `SELECT type, payload, timestamp
     FROM events
     WHERE session_id = $1
     ORDER BY timestamp ASC`,
    [sessionId]
  );

  const allEvents: Event[] = result.rows.map(row => {
    const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
    return {
      type: row.type,
      timestamp: Number(row.timestamp),
      meta: payload.meta || {}
    };
  });

  await detectRageClicks(client, projectId, sessionId, allEvents);
  await detectDeadClicks(client, projectId, sessionId, allEvents);
}
