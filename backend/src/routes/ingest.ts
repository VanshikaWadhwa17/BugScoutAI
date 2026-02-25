import { Router, Request, Response } from 'express';
import { getClient } from '../db';
import { ingestEvents } from '../services/ingest.service';

const router = Router();

/**
 * GET /ingest - Info endpoint
 */
router.get('/', (req: Request, res: Response) => {
  res.json({
    success: false,
    message: 'Use POST method to ingest events',
    method: 'POST',
    headers: {
      'X-API-Key': 'Your project API key',
      'Content-Type': 'application/json'
    },
    body: {
      session_id: 'string',
      events: [
        {
          type: 'click',
          timestamp: 1730000000000,
          meta: {
            selector: '#button'
          }
        }
      ]
    },
    example: 'curl -X POST http://localhost:3000/ingest -H "X-API-Key: your-api-key" -H "Content-Type: application/json" -d \'{"session_id":"test","events":[]}\''
  });
});

/**
 * POST /ingest
 * Ingests events from SDK
 * 
 * Headers:
 *   X-API-Key: <project_api_key>
 * 
 * Body:
 *   {
 *     "session_id": "sess_123",
 *     "events": [...]
 *   }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // Accept API key from header or body (body needed for sendBeacon which can't set headers)
    const apiKey = (req.headers['x-api-key'] as string) || req.body?.api_key;
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: 'API key required in X-API-Key header or body.api_key'
      });
    }
    
    const payload = req.body;
    
    // Get database client
    const client = await getClient();
    
    try {
      const result = await ingestEvents(client, apiKey, payload);
      
      if (!result.success) {
        return res.status(400).json(result);
      }
      
      res.json(result);
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('[INGEST_ERROR]', req.id, error?.message || error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

export default router;
