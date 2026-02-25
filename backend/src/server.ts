import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';
import ingestRoutes from './routes/ingest';
import dashboardRoutes from './routes/dashboard';

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

// Try loading .env from backend directory first, then parent directory
const backendEnv = join(process.cwd(), '.env');
const rootEnv = join(process.cwd(), '..', '.env');

if (existsSync(backendEnv)) {
  dotenv.config({ path: backendEnv });
} else if (existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
} else {
  dotenv.config(); // Fallback to default behavior
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware – allow demo and frontend origins for SDK ingest
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5000', 'http://127.0.0.1:3000', 'http://127.0.0.1:5000'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-API-Key', 'X-Auth-Token']
}));
app.use(express.json());

// Request correlation ID for debugging
app.use((req, _res, next) => {
  req.id = crypto.randomUUID();
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root route - API info
app.get('/', (req, res) => {
  res.json({
    name: 'NomadAI MVP Backend',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      ingest: 'POST /ingest',
      dashboard: 'GET /dashboard'
    },
    docs: {
      ingest: 'POST /ingest - Send events with X-API-Key header',
      dashboard: 'GET /dashboard/* - Access dashboard APIs with X-Auth-Token header'
    }
  });
});

// Routes
app.use('/ingest', ingestRoutes);
app.use('/dashboard', dashboardRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Dashboard API: http://localhost:${PORT}/dashboard`);
  console.log(`📥 Ingestion API: http://localhost:${PORT}/ingest`);
});
