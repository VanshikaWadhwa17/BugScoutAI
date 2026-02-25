# BugScoutAI SDK – Local testing

Backend must be running (`cd backend && npm run dev`). Then:

## 1. Get your API key

From repo root:

```bash
cd backend
npm run db:api-keys
```

Copy one of the API keys (e.g. `test-api-key-xxxxx`). If you see "No projects found", run `npm run db:setup` first.

## 2. Put the key in the demo page

Edit `demo-site/index.html` and set `apiKey` to your key:

```js
bugScoutAI.init({
  apiKey: 'YOUR_API_KEY_HERE',
  apiHost: 'http://localhost:3000'
})
```

## 3. Serve the repo over HTTP

Backend uses port 3000, so serve the demo on another port. From **repo root**:

```bash
npx serve . -l 5000
```

Then open: **http://localhost:5000/demo-site/**

## 4. Test

- Click **Broken Button** a few times (or spam for rage-click).
- Wait ~5 seconds for the SDK to flush, or refresh the page (sends a page_view).
- In **DevTools → Network**: filter by "ingest" and confirm POSTs to your backend.
- In **backend terminal**: you should see ingest requests and events saved.
- In **dashboard** (Next.js frontend): sessions and events should appear.

## 5. If backend is on another port

Change `apiHost` in the demo, e.g. `http://localhost:5000` if your backend runs on 5000.
