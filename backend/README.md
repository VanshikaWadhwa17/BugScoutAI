# BugScoutAI Backend (MVP)

Simple backend for session replay and UX analytics. Built for speed and demos.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Neon account (free tier available) - [Sign up here](https://neon.tech)

### Setup

1. **Install dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **Set up Neon database**

   Follow the options below to configure your Neon PostgreSQL database.

   **Option A: Using Neon Console (Recommended)**
   
   a. Sign up at [neon.tech](https://neon.tech) (free tier available)
   
   b. Create a new project
   
   c. Go to **Connection Details** → Copy the connection string
   
   d. It will look like:
      ```
      postgresql://username:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require
      ```
   
   **Option B: Using Neon CLI**
   ```bash
   npm install -g neonctl
   neonctl projects create --name nomadai
   neonctl connection-string
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Paste your Neon connection string into DATABASE_URL
   # Generate a secure AUTH_TOKEN: openssl rand -hex 32
   ```

4. **Run database migrations**
   ```bash
   npm run db:setup
   ```
   
   This will create all tables automatically.

5. **Start server**
   ```bash
   npm run dev
   ```
   
   The server will be running at `http://localhost:3000`

**Tip:** make sure `DATABASE_URL` and `AUTH_TOKEN` are set before running `npm run db:setup`.

## 📡 API Endpoints

### Ingestion API

#### `POST /ingest`

Ingest events from SDK.

**Headers:**
```
X-API-Key: <project_api_key>
```

**Body:**
```json
{
  "session_id": "sess_123",
  "events": [
    {
      "type": "click",
      "timestamp": 1730000000,
      "meta": {
        "selector": "#checkout"
      }
    },
    {
      "type": "scroll",
      "timestamp": 1730000100,
      "meta": {
        "scrollY": 500
      }
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "eventsSaved": 2,
  "message": "Saved 2 events"
}
```

### Dashboard API

All dashboard endpoints require authentication via `X-Auth-Token` header (matches `AUTH_TOKEN` in `.env`).

#### `GET /dashboard/sessions`

Get all sessions.

**Query params:**
- `project_id` (optional): Filter by project ID
- `limit` (optional): Limit results (default: 100)
- `offset` (optional): Pagination offset

**Example:**
```bash
curl -H "X-Auth-Token: your-secret-token" \
  http://localhost:3000/dashboard/sessions?project_id=1
```

#### `GET /dashboard/sessions/:id/events`

Get events for a specific session (timeline format).

**Example:**
```bash
curl -H "X-Auth-Token: your-secret-token" \
  http://localhost:3000/dashboard/sessions/sess_123/events
```

**Response:**
```json
{
  "success": true,
  "session_id": "sess_123",
  "events": [
    {
      "id": 1,
      "type": "click",
      "timestamp": 1730000000,
      "meta": {
        "selector": "#pricing"
      }
    }
  ]
}
```

#### `GET /dashboard/issues`

Get detected issues.

**Query params:**
- `project_id` (optional): Filter by project ID
- `session_id` (optional): Filter by session ID
- `issue_type` (optional): Filter by type (`rage_click` or `dead_click`)
- `limit` (optional): Limit results (default: 100)

**Example:**
```bash
curl -H "X-Auth-Token: your-secret-token" \
  http://localhost:3000/dashboard/issues?issue_type=rage_click
```

## 🔍 Issue Detection

The backend detects two types of issues **inline** (no queues, no workers):

### Rage Clicks
- **Rule**: Same element, ≥4 clicks, ≤2 seconds
- Detected automatically when events are ingested

### Dead Clicks
- **Rule**: Click event with no navigation or DOM mutation within 1 second
- Detected automatically when events are ingested

## 📊 Database Schema

### `projects`
- `id` (SERIAL PRIMARY KEY)
- `name` (VARCHAR)
- `api_key` (VARCHAR, UNIQUE)

### `sessions`
- `session_id` (VARCHAR PRIMARY KEY)
- `project_id` (INTEGER, FK)
- `started_at` (TIMESTAMP)
- `last_event_at` (TIMESTAMP)

### `events`
- `id` (SERIAL PRIMARY KEY)
- `project_id` (INTEGER, FK)
- `session_id` (VARCHAR, FK)
- `type` (VARCHAR)
- `payload` (JSONB)
- `timestamp` (BIGINT)

### `issues`
- `id` (SERIAL PRIMARY KEY)
- `project_id` (INTEGER, FK)
- `session_id` (VARCHAR, FK)
- `issue_type` (VARCHAR)
- `element` (TEXT)
- `created_at` (TIMESTAMP)

## 🧪 Testing

### Get Your API Key

First, get your API key from the database:

```bash
npm run db:api-keys
```

### Test Ingestion

**Bash/Linux/Mac:**
```bash
curl -X POST http://localhost:3000/ingest \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{
    "session_id": "test_session_1",
    "events": [
      {
        "type": "click",
        "timestamp": 1730000000000,
        "meta": {"selector": "#button"}
      }
    ]
  }'
```

**PowerShell (Windows):**
```powershell
$apiKey = "YOUR_API_KEY"
$body = '{"session_id":"test_session_1","events":[{"type":"click","timestamp":1730000000000,"meta":{"selector":"#button"}}]}'
Invoke-RestMethod -Uri "http://localhost:3000/ingest" -Method Post -Headers @{"X-API-Key"=$apiKey;"Content-Type"="application/json"} -Body $body
```

**Or use the PowerShell script:**
```powershell
cd backend\examples
.\test-ingest.ps1 -ApiKey "YOUR_API_KEY"
```

### Test Rage Click Detection

Send 4 clicks on the same element within 2 seconds:

**PowerShell:**
```powershell
$apiKey = "YOUR_API_KEY"
$body = @{
    session_id = "rage_test"
    events = @(
        @{ type = "click"; timestamp = 1730000000000; meta = @{ selector = "#pricing" } },
        @{ type = "click"; timestamp = 1730000000500; meta = @{ selector = "#pricing" } },
        @{ type = "click"; timestamp = 1730000001000; meta = @{ selector = "#pricing" } },
        @{ type = "click"; timestamp = 1730000001500; meta = @{ selector = "#pricing" } }
    )
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri "http://localhost:3000/ingest" -Method Post -Headers @{"X-API-Key"=$apiKey;"Content-Type"="application/json"} -Body $body
```

This should trigger a rage click detection (4 clicks on same element within 2 seconds).

## 📁 Project Structure

```
backend/
  src/
    server.ts              # Main server file
    routes/
      ingest.ts           # POST /ingest route
      dashboard.ts        # Dashboard API routes
    db/
      index.ts            # Database connection
      schema.sql          # Database schema
    services/
      ingest.service.ts   # Ingestion logic
      issueDetector.ts    # Issue detection rules
```

## 🎯 MVP Scope

**What's included:**
- ✅ Multi-project support
- ✅ API key authentication
- ✅ Event ingestion
- ✅ Session tracking
- ✅ Rage click detection
- ✅ Dead click detection
- ✅ Session timeline API
- ✅ Issues API

**What's NOT included (by design):**
- ❌ User authentication
- ❌ Organizations/roles
- ❌ Queues/workers
- ❌ Background jobs
- ❌ Full DOM replay
- ❌ Heatmaps
- ❌ Funnels
- ❌ Feature flags

## 🔧 Development

```bash
# Development mode (with hot reload)
npm run dev

# Build
npm run build

# Production
npm start
```

## 📝 Notes

- Issue detection runs **inline** during ingestion (no async processing)
- All events are stored as-is in JSONB format
- Session replay is simplified to event timeline (no DOM mutations)
- Dashboard API uses simple token auth (no OAuth/JWT)
