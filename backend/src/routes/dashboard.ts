import { Router, Request, Response } from 'express';
import { query } from '../db';

const router = Router();

/**
 * Simple auth middleware for MVP
 * Uses AUTH_TOKEN from env or X-Auth-Token header
 */
const authMiddleware = (req: Request, res: Response, next: Function) => {
  const token = req.headers['x-auth-token'] as string || process.env.AUTH_TOKEN;
  const expectedToken = process.env.AUTH_TOKEN;
  
  if (!expectedToken || token !== expectedToken) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized'
    });
  }
  
  next();
};

// Apply auth to all dashboard routes
router.use(authMiddleware);

// Root dashboard route - show available endpoints
router.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Dashboard API',
    endpoints: {
      sessions: 'GET /dashboard/sessions',
      sessionEvents: 'GET /dashboard/sessions/:id/events',
      sessionExport: 'GET /dashboard/sessions/:id/export',
      sessionConsoleLogs: 'GET /dashboard/sessions/:id/console-logs',
      issues: 'GET /dashboard/issues',
      issuesSummary: 'GET /dashboard/issues/summary'
    },
    queryParams: {
      sessions: ['project_id', 'limit', 'offset', 'user_id', 'min_duration_seconds', 'url_contains'],
      issues: ['project_id', 'session_id', 'issue_type', 'limit']
    }
  });
});

/**
 * GET /sessions
 * Get all sessions with optional filters (project, user, min duration, URL)
 *
 * Query params:
 *   project_id (optional): Filter by project ID
 *   user_id (optional): Filter by user identity
 *   min_duration_seconds (optional): Only sessions at least this long
 *   url_contains (optional): Only sessions with at least one event whose meta.url contains this string
 *   limit (optional): Limit results (default: 100)
 *   offset (optional): Offset for pagination
 */
router.get('/sessions', async (req: Request, res: Response) => {
  try {
    const projectId = req.query.project_id as string;
    const userId = req.query.user_id as string;
    const minDurationSeconds = req.query.min_duration_seconds as string;
    const urlContains = req.query.url_contains as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const offset = parseInt(req.query.offset as string) || 0;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (projectId) {
      conditions.push(`s.project_id = $${paramIndex}`);
      params.push(projectId);
      paramIndex++;
    }
    if (userId) {
      conditions.push(`s.user_id = $${paramIndex}`);
      params.push(userId);
      paramIndex++;
    }
    if (minDurationSeconds) {
      const sec = parseFloat(minDurationSeconds);
      if (!isNaN(sec)) {
        conditions.push(`(EXTRACT(EPOCH FROM (s.last_event_at - s.started_at)) >= $${paramIndex})`);
        params.push(sec);
        paramIndex++;
      }
    }
    if (urlContains) {
      conditions.push(`EXISTS (
        SELECT 1 FROM events e
        WHERE e.session_id = s.session_id
        AND e.payload->'meta'->>'url' ILIKE $${paramIndex}
      )`);
      params.push('%' + urlContains + '%');
      paramIndex++;
    }

    const whereClause = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';

    const sql = `
      SELECT
        s.session_id,
        s.project_id,
        p.name AS project_name,
        s.started_at,
        s.last_event_at,
        s.click_count,
        s.page_view_count,
        s.issue_count,
        s.user_id,
        s.user_email,
        EXTRACT(EPOCH FROM (s.last_event_at - s.started_at)) AS duration_seconds
      FROM sessions s
      LEFT JOIN projects p ON s.project_id = p.id
      ${whereClause}
      ORDER BY s.last_event_at DESC NULLS LAST
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const result = await query(sql, params);

    res.json({
      success: true,
      sessions: result.rows.map(row => ({
        session_id: row.session_id,
        project_id: row.project_id,
        project_name: row.project_name,
        started_at: row.started_at,
        last_event_at: row.last_event_at,
        duration_seconds: row.duration_seconds != null ? parseFloat(row.duration_seconds) : null,
        click_count: parseInt(row.click_count) || 0,
        page_view_count: parseInt(row.page_view_count) || 0,
        issue_count: parseInt(row.issue_count) || 0,
        user_id: row.user_id ?? undefined,
        user_email: row.user_email ?? undefined
      }))
    });
  } catch (error: any) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * GET /sessions/:id/events
 * Get all events for a specific session
 * Returns events in timeline format for simple replay
 */
router.get('/sessions/:id/events', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.id;
    
    const result = await query(
      `SELECT 
        id,
        type,
        payload,
        timestamp,
        created_at
       FROM events
       WHERE session_id = $1
       ORDER BY timestamp ASC`,
      [sessionId]
    );
    
    // Format events for timeline display
    const events = result.rows.map(row => {
      const payload = typeof row.payload === 'string' 
        ? JSON.parse(row.payload) 
        : row.payload;
      
      return {
        id: row.id,
        type: row.type,
        timestamp: row.timestamp,
        created_at: row.created_at,
        meta: payload.meta || {}
      };
    });
    
    res.json({
      success: true,
      session_id: sessionId,
      events
    });
  } catch (error: any) {
    console.error('Get session events error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * GET /sessions/:id/export
 * Export a session with all events as a single JSON payload (for export/share)
 */
router.get('/sessions/:id/export', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.id;

    const sessionRow = await query(
      `SELECT s.session_id, s.project_id, p.name AS project_name,
              s.started_at, s.last_event_at, s.user_id, s.user_email,
              s.click_count, s.page_view_count, s.issue_count,
              EXTRACT(EPOCH FROM (s.last_event_at - s.started_at)) AS duration_seconds
       FROM sessions s
       LEFT JOIN projects p ON s.project_id = p.id
       WHERE s.session_id = $1`,
      [sessionId]
    );
    if (sessionRow.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    const session = sessionRow.rows[0];
    const eventsResult = await query(
      `SELECT id, type, payload, timestamp, created_at
       FROM events WHERE session_id = $1 ORDER BY timestamp ASC`,
      [sessionId]
    );

    const events = eventsResult.rows.map(row => {
      const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
      return {
        id: row.id,
        type: row.type,
        timestamp: row.timestamp,
        created_at: row.created_at,
        meta: payload.meta || {}
      };
    });

    res.json({
      success: true,
      session: {
        session_id: session.session_id,
        project_id: session.project_id,
        project_name: session.project_name,
        started_at: session.started_at,
        last_event_at: session.last_event_at,
        duration_seconds: session.duration_seconds != null ? parseFloat(session.duration_seconds) : null,
        user_id: session.user_id ?? undefined,
        user_email: session.user_email ?? undefined,
        click_count: parseInt(session.click_count) || 0,
        page_view_count: parseInt(session.page_view_count) || 0,
        issue_count: parseInt(session.issue_count) || 0
      },
      events
    });
  } catch (error: any) {
    console.error('Export session error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * GET /sessions/:id/console-logs
 * Return only console-type events for a session (for debugging)
 */
router.get('/sessions/:id/console-logs', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.id;

    const result = await query(
      `SELECT id, type, payload, timestamp, created_at
       FROM events
       WHERE session_id = $1 AND type = $2
       ORDER BY timestamp ASC`,
      [sessionId, 'console']
    );

    const logs = result.rows.map(row => {
      const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
      return {
        id: row.id,
        type: row.type,
        timestamp: row.timestamp,
        created_at: row.created_at,
        level: payload.meta?.level,
        message: payload.meta?.message,
        meta: payload.meta || {}
      };
    });

    res.json({
      success: true,
      session_id: sessionId,
      console_logs: logs
    });
  } catch (error: any) {
    console.error('Get console logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * GET /issues/summary
 * Aggregated counts of issues by type and by project (for dashboard widgets)
 */
router.get('/issues/summary', async (req: Request, res: Response) => {
  try {
    const projectId = req.query.project_id as string;

    let sql = `
      SELECT
        i.issue_type,
        i.project_id,
        p.name AS project_name,
        COUNT(*) AS count
      FROM issues i
      LEFT JOIN projects p ON i.project_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (projectId) {
      sql += ` AND i.project_id = $1`;
      params.push(projectId);
    }
    sql += ` GROUP BY i.issue_type, i.project_id, p.name`;

    const result = await query(sql, params);

    const byType: Record<string, number> = {};
    const byProject: Record<string, { project_id: number; project_name: string; count: number }> = {};

    result.rows.forEach(row => {
      const type = row.issue_type;
      byType[type] = (byType[type] || 0) + parseInt(row.count);
      const key = String(row.project_id);
      if (!byProject[key]) {
        byProject[key] = {
          project_id: row.project_id,
          project_name: row.project_name || '',
          count: 0
        };
      }
      byProject[key].count += parseInt(row.count);
    });

    res.json({
      success: true,
      by_issue_type: byType,
      by_project: Object.values(byProject)
    });
  } catch (error: any) {
    console.error('Get issues summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * GET /issues
 * Get all issues with optional filters
 *
 * Query params:
 *   project_id (optional): Filter by project ID
 *   session_id (optional): Filter by session ID
 *   issue_type (optional): Filter by issue type (rage_click, dead_click)
 *   limit (optional): Limit results (default: 100)
 */
router.get('/issues', async (req: Request, res: Response) => {
  try {
    const projectId = req.query.project_id as string;
    const sessionId = req.query.session_id as string;
    const issueType = req.query.issue_type as string;
    const limit = parseInt(req.query.limit as string) || 100;
    
    let sql = `
      SELECT
        i.id,
        i.project_id,
        p.name AS project_name,
        i.session_id,
        i.issue_type,
        i.element,
        i.severity,
        i.occurrence_count,
        i.first_seen_at,
        i.last_seen_at,
        i.created_at
      FROM issues i
      LEFT JOIN projects p ON i.project_id = p.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramIndex = 1;
    
    if (projectId) {
      sql += ` AND i.project_id = $${paramIndex}`;
      params.push(projectId);
      paramIndex++;
    }
    
    if (sessionId) {
      sql += ` AND i.session_id = $${paramIndex}`;
      params.push(sessionId);
      paramIndex++;
    }
    
    if (issueType) {
      sql += ` AND i.issue_type = $${paramIndex}`;
      params.push(issueType);
      paramIndex++;
    }
    
    sql += ` ORDER BY i.created_at DESC LIMIT $${paramIndex}`;
    params.push(limit);
    
    const result = await query(sql, params);
    
    res.json({
      success: true,
      issues: result.rows.map(row => ({
        id: row.id,
        project_id: row.project_id,
        project_name: row.project_name,
        session_id: row.session_id,
        issue_type: row.issue_type,
        element: row.element,
        severity: row.severity || 'low',
        occurrence_count: parseInt(row.occurrence_count) || 1,
        first_seen_at: row.first_seen_at,
        last_seen_at: row.last_seen_at,
        created_at: row.created_at
      }))
    });
  } catch (error: any) {
    console.error('Get issues error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

export default router;
