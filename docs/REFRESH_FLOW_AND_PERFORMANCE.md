# Refresh Flow & Performance Notes

## What “Refresh” does (today)

### Frontend UX

There are two ways refresh can be triggered:

1. **Automatic (on first app load, in the background)**
   - Implemented in the authenticated app shell.
   - Runs **once per app session** after auth resolves.
   - Calls the refresh endpoint **without showing the logo loading overlay**.
   - If the refresh fails (network/auth/server), the app continues normally (best-effort).

2. **Manual (user presses the Refresh button on Dashboard)**
   - Shows the **logo loading overlay** immediately.
   - Calls the refresh endpoint.
  - If the backend reports `already_running`, the UI switches the button into **Running…** (disabled) by tracking the live job status.
    - The overlay is dismissed (so the app stays usable).
    - The client stores the returned `jobId` and subscribes to `jobs/{jobId}`.

### Frontend API call

- Client calls `triggerRefresh()` which:
  - Requires Firebase auth (`currentUser.getIdToken()`)
  - Sends `POST` to `VITE_REFRESH_URL`
  - Retries once on `invalid_token`

### Backend / Cloud Function flow

The refresh endpoint is implemented as a Cloud Function which:

1. **Authenticates + allowlists** the caller.
2. **Acquires a global refresh lock** (Firestore doc `jobs_lock/refresh` with TTL).
   - If the lock is already held, the function responds with HTTP `409` and code `already_running`.
3. **Creates a job record** in `jobs/*`.
4. **Runs the refresh computation** (engine):
   - Resolves `targetMonth`.
   - Determines missing months and generates snapshots for missing months in chronological order.
   - Always upserts `snapshots/{targetMonth}` to keep History consistent.
   - Writes per-metric breakdown docs under:
     - `snapshots/{month}/metricBreakdowns/{metricKey}`
   - Overwrites `dashboard/latest` using the `targetMonth` metrics.
5. **Releases the lock**.

## Why refresh can feel slow

The refresh pipeline is doing “end-to-end” work:

- Fetching a lot of ClickUp tasks (and sometimes comments)
- Computing metrics + diffs
- Writing multiple Firestore docs (snapshots + breakdown docs + dashboard/latest)
- Sometimes generating a chain of missing months (if Firestore has gaps)

Even if the UI is fast, the backend is still doing a fairly heavy workload.

## Performance suggestions (no implementation)

### Reduce the amount of work per refresh

- **Default to only refreshing `targetMonth`**, and only generate missing months when explicitly requested.
  - Today refresh may generate a chain of missing months.

- **Skip recomputation when inputs are unchanged**.
  - Persist an “inputs fingerprint” (e.g., ClickUp list updated timestamps, counts, etc.) and skip if identical.

### Make ClickUp fetching faster

- **Parallelize independent ClickUp fetches** (lists, metadata, comment fetches) with `Promise.all`.

- **Fetch less data**:
  - Filter queries by status/date when the API supports it.
  - Avoid fetching all closed subtasks if they’re not used.

- **Cache raw ClickUp results** (per month) in Firestore or Cloud Storage.
  - Refresh becomes: fetch new/changed tasks → update cache → compute metrics from cache.

### Minimize comment fetching

- **Fetch comments only for tasks that need them**.
  - Example: deposits / WoM matching / any logic that relies on comments.

- **Cache comments by `taskId` + lastUpdated/version**.
  - Don’t refetch comments if the task/comment thread hasn’t changed.

### Improve write efficiency

- **Write only what changed**:
  - If a breakdown doc content is identical, avoid rewriting it.
  - Keep `computedAt` stable when no changes are detected.

- **Split refresh into phases** (fetch → compute → write) and persist intermediate results.
  - Retries can resume without re-fetching external APIs.


## Relevant code locations

- Frontend refresh API: `src/lib/api/refresh.ts`
- Startup auto-refresh: `src/routes/RequireAuth.tsx`
- Dashboard manual refresh overlay: `src/pages/DashboardPage.tsx`
- Refresh job runtime store + listener: `src/lib/refresh/*`
- Backend refresh entry: `functions/src/refresh.ts` + `functions/src/refresh/refreshHandler.ts`
- Refresh lock: `functions/src/refresh/lock.ts`
- Refresh implementation: `functions/src/refresh/runRefresh.ts`
