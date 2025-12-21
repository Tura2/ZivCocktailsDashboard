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

### Auth model

- Production:
  - Requires `Authorization: Bearer <Firebase ID token>`
  - Validates token via Admin SDK, then checks email against `access/allowlist.emails`
- Emulator/dev:
  - Can send `x-dev-email: you@example.com` when `FUNCTIONS_EMULATOR=true`

### Target month resolution

- If request body includes `targetMonth`, it is validated and used.
- Otherwise it uses the snapshot rule: **target month is the previous calendar month**.

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
