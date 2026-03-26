# BugScoutAI

BugScoutAI ingests browser UX/event telemetry via a lightweight SDK, stores it in Postgres (Neon), and runs issue-detection rules during ingestion. It exposes ingestion endpoints plus dashboard-style APIs for querying sessions, events, and issues.

## What's Included

- `sdk/`: Browser SDK (buildable UMD bundle for the demo page)
- `backend/`: Node/Express backend + Postgres schema + issue detection + API routes
- `demo-site/`: Simple HTML page to validate that events are sent and ingested

## Quick Start (Local)

### 1) Start the backend

Prerequisites:

- Node.js 18+
- Neon PostgreSQL account

From the repo root:

```bash
cd backend
npm install

# Configure env
cp .env.example .env
# Edit DATABASE_URL and AUTH_TOKEN in backend/.env

# Create tables + seed required rows
npm run db:setup

# Run API server (default: http://localhost:3000)
npm run dev
```

Backend endpoints:

- Ingestion: `POST /ingest` (auth via `X-API-Key`)
- Dashboard APIs: `GET /dashboard/*` (auth via `X-Auth-Token`)

See `backend/README.md` for a full endpoint reference.

### 2) Run the demo page

From the repo root:

```bash
# Serve the repo over HTTP (so the browser can load the SDK)
npx serve . -l 5000
```

1. Edit `demo-site/index.html`
2. Update:
   - `apiKey` to one of your project API keys
   - `apiHost` if your backend isn't on `http://localhost:3000`
3. Open: `http://localhost:5000/demo-site/`

If everything is wired correctly, you should see ingestion requests in the backend logs and data become queryable via the dashboard APIs.

### 3) (Optional) Get an API key

```bash
cd backend
npm run db:api-keys
```

## SDK Usage

The SDK is configured by calling:

```js
bugScoutAI.init({
  apiKey: "YOUR_API_KEY",
  apiHost: "http://localhost:3000",
});
```

The demo page loads the built bundle from `sdk/dist/index.global.js`.

If you need to rebuild the SDK bundle:

```bash
cd sdk
npm install
npm run build
```

## Environment Variables

Backend uses these env vars (see `backend/.env.example`):

- `DATABASE_URL`: Neon Postgres connection string
- `PORT`: Server port (default `3000`)
- `AUTH_TOKEN`: Required for `GET /dashboard/*` endpoints

## Docs

- Backend docs: [`backend/README.md`](./backend/README.md)
- Demo setup: [`demo-site/README.md`](./demo-site/README.md)

