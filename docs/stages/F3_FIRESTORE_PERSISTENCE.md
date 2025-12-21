# F3 — Firestore Persistence Layer (Cloud Functions)

This document describes the **server-side persistence layer** that:

- Runs the F1+F2 computation engine in a trusted environment (Firebase Cloud Functions)
- Writes **computed outputs only** to Firestore (`dashboard/latest` and `snapshots/{YYYY-MM}`)
- Tracks job status and logs (`jobs/{jobId}`)

**Hard constraints (F3):**

- No secrets in Electron/renderer
- Client remains **read-only** in Firestore rules (writes denied for all clients)
- Cloud Functions are the only writer to Firestore

Related docs:

- Roadmap: [ROADMAP.md](../ROADMAP.md)
- F1 compute engine: [F1_CLOUD_DATA_ENGINE.md](F1_CLOUD_DATA_ENGINE.md)
- F2 snapshot engine: [F2_SNAPSHOT_ENGINE.md](F2_SNAPSHOT_ENGINE.md)
- Firestore rules: [firestore.rules](../../firestore.rules)

---

## Where the code lives

- Functions entrypoint: [functions/src/index.ts](../../functions/src/index.ts)
- Request handler: [functions/src/refresh/refreshHandler.ts](../../functions/src/refresh/refreshHandler.ts)
- Refresh job runner: [functions/src/refresh/runRefresh.ts](../../functions/src/refresh/runRefresh.ts)
- Allowlist authz: [functions/src/refresh/authz.ts](../../functions/src/refresh/authz.ts)
- Job tracking: [functions/src/refresh/jobs.ts](../../functions/src/refresh/jobs.ts)
- Job lock (single-flight): [functions/src/refresh/lock.ts](../../functions/src/refresh/lock.ts)
- Admin SDK init: [functions/src/refresh/firebaseAdmin.ts](../../functions/src/refresh/firebaseAdmin.ts)

---

## Firestore data model (F3)

### `access/allowlist`

- Document: `access/allowlist`
- Field: `emails: string[]`
- Used in:
  - Firestore rules (client reads)
  - Cloud Function authz (refresh endpoint)

### `snapshots/{YYYY-MM}`

- Immutable per-month snapshots.
- Written with `create()` so re-runs are idempotent (already-existing snapshots are skipped).
- Fields:
  - `version: "v1"`
  - `month: "YYYY-MM"`
  - `computedAt: ISO string`
  - `metrics: DashboardMetrics` (from F1)
  - `diffFromPreviousPct: DiffObject` (from F2)

### `dashboard/latest`

- Always overwritten (`set(..., { merge: false })`) to reflect the computed metrics for the resolved target month.
- Fields:
  - `version: "v1"`
  - `month: "YYYY-MM"`
  - `computedAt: ISO string`
  - `metrics: DashboardMetrics`

### `jobs/{jobId}`

- Job status and logs for refresh runs.
- Status flow: `running` → `success` | `error`.
- Includes:
  - `requestedByEmail`
  - `targetMonth`
  - `writtenSnapshots: string[]`
  - `skippedSnapshots: string[]`
  - `logs: string[]` (trimmed to keep size bounded)
  - `error?: { message: string; code?: string }`

### `jobs_lock/refresh`

- Single-flight lock doc to prevent concurrent refresh.
- Uses a TTL-style `expiresAtMs` so crashes don’t permanently brick refresh.

---

## Refresh endpoint behavior

### HTTP endpoint

- Export: `refresh` in [functions/src/index.ts](../../functions/src/index.ts)
- Method: `POST` only
- Response:
  - `200` on success
  - `409` if another refresh is already running
  - `401/403` for auth/allowlist failures

### Deployed URL (Gen2)

Prefer calling the stable Functions URL (this is what `VITE_REFRESH_URL` should point to):

- `https://me-west1-<firebaseProjectId>.cloudfunctions.net/refresh`

Firebase deploy output will also show a Cloud Run service URL (`https://refresh-<hash>.a.run.app`). Avoid hard-coding that in docs/config unless you have a specific reason.

### CORS (browser/Electron renderer)

Problem summary:

- Browser/Electron renderer requests were blocked because the `OPTIONS` preflight did not receive valid CORS headers.

Root cause:

- The request uses `Authorization: Bearer <Firebase ID token>` and `Content-Type: application/json`, which triggers an `OPTIONS` preflight.
- Cloud Functions v2 HTTP handlers do not automatically handle CORS/preflight; the function must return CORS headers for both `OPTIONS` and `POST`.

Fix (server-side):

- Add CORS middleware to the `refresh` HTTP function.
- Ensure `OPTIONS /refresh` returns `204` and includes CORS headers.
- Ensure `POST /refresh` includes CORS headers and then proceeds to auth verification + computation.

Allowed origins/headers (current policy):

- Allowed origin includes `http://localhost:5173` (Vite dev)
- Production origin: placeholder allowlist via env (Electron custom protocol / hosted origin)
- Allowed headers include `Authorization`, `Content-Type`, `x-dev-email`
- Allowed methods: `POST`, `OPTIONS`

### Auth model

- Production:
  - Requires `Authorization: Bearer <Firebase ID token>`
  - Validates token via Admin SDK, then checks email against `access/allowlist.emails`
- Emulator/dev:
  - Can send `x-dev-email: you@example.com` when `FUNCTIONS_EMULATOR=true`

### Secrets (ClickUp / Instagram)

Third-party API credentials are stored in **Google Cloud Secret Manager** and injected into the Gen2 service via the Functions **Params API** (`defineSecret`).

- Do not put ClickUp/Instagram secrets in renderer `.env`.
- Do not rely on `functions/.env` for production; Gen2 runs on Cloud Run and only sees deploy-time env/secrets.

One-time setup per Firebase project:

```bash
firebase functions:secrets:set CLICKUP_API_TOKEN
firebase functions:secrets:set INSTAGRAM_ACCESS_TOKEN
firebase functions:secrets:set INSTAGRAM_IG_USER_ID
```

Deploy to apply secret bindings:

```bash
firebase deploy --only functions
```

Important: avoid configuring the same key as both a normal env var and a Secret binding (Cloud Run rejects overlaps).

### Target month resolution

- If request body includes `targetMonth`, it is validated and used.
- Otherwise it uses the snapshot rule: **target month is the current month (UTC)**.

Note: month targeting logic lives in the backend engine (`backend/snapshots/monthLogic.ts`) and is copied into the Functions build.

### Snapshot write semantics (idempotent)

- Missing months are detected by reading the latest snapshot month in Firestore and listing gaps.
- For each month:
  - write `snapshots/{YYYY-MM}` using `create()`
  - if it already exists, skip it

### Latest dashboard write semantics

- `dashboard/latest` is always overwritten for the resolved target month.

---

## How the compute engine is packaged into Functions

The Functions repo does not directly import TypeScript from `backend/`.

Instead:

1. Build the engine from repo root: `npm run f1:build`
2. Functions build copies the compiled engine into `functions/engine`:
   - Script: [functions/scripts/copy-engine.js](../../functions/scripts/copy-engine.js)
   - Source: `dist/engine`

This keeps secrets and execution in the server environment while reusing the deterministic computation code.

---

## Local usage (quick)

From repo root:

- Build engine: `npm run f1:build`
- Install functions deps: `npm --prefix functions install`
- Build functions: `npm --prefix functions run build`
- Run emulators (optional): `npm --prefix functions run serve`

Notes:

- Client Firestore writes are denied by design; all writes happen via Admin SDK in the Function.

---

## How to validate (CORS + refresh runtime)

### DevTools (renderer)

- Trigger refresh from the app.
- In DevTools → Network you should see:
  - An `OPTIONS` request to the refresh URL returning `204`
  - Then a `POST` request returning `200` (or a JSON auth error such as `401/403`, but not a CORS error)

Expected `OPTIONS` response headers include:

- `Access-Control-Allow-Origin: http://localhost:5173`
- `Access-Control-Allow-Methods` includes `POST` and `OPTIONS`
- `Access-Control-Allow-Headers` includes `Authorization`, `Content-Type`, `x-dev-email`

### Cloud logs

- Verify function logs show both:
  - `OPTIONS /refresh`
  - `POST /refresh`
