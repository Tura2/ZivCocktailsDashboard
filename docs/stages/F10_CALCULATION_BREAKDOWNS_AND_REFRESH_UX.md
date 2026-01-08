# F10 — Calculation Breakdowns + Refresh UX

**Goal:**

- Make KPIs explainable (calculation transparency) without bloating `dashboard/latest` / `snapshots/*`.
- Make refresh safe and predictable for users (background auto-refresh + clear running state).

---

## 1) KPI calculation breakdowns (Firestore-backed)

### What it is

A per-metric breakdown document that the UI can lazy-load on hover to explain how a KPI was computed.

Why a separate doc?

- Keeps `dashboard/latest` fast to read.
- Avoids loading breakdown data unless the user requests it.
- Allows adding breakdown coverage per metric incrementally.

### Storage

Docs live under the snapshot document:

- `snapshots/{YYYY-MM}/metricBreakdowns/{metricKey}`

Each doc is a small typed payload (names list, line-items list, or none).

### Write path

Breakdowns are produced by the engine and written by refresh:

- Engine: `backend/dashboard/computeDashboard.ts` (`computeDashboardWithBreakdowns`)
- Persistence: `functions/src/refresh/runRefresh.ts`

### Read path

The UI lazy-loads breakdowns on hover:

- Hook: `src/hooks/useMetricBreakdown.ts`
- Tooltip renderer: `src/components/dashboard/BreakdownTooltip.tsx`
- KPI card: `src/components/dashboard/MetricCard.tsx`
- Used by: Dashboard + History grids via `src/components/dashboard/KpiGrid.tsx`

### Notes / behaviors

- Missing docs are treated as “no breakdown” and are not cached, so a later refresh can start producing them without requiring an app restart.
- Some UI metric keys are aliased to canonical Firestore doc IDs (e.g. gross-suffixed display keys).

---

## 2) Refresh UX and job tracking

### What changed

There are now two refresh triggers:

1. **Auto refresh (background)**
   - Runs once per app session after auth resolves.
   - Does not show the logo loading overlay.
   - If refresh fails, the app continues normally (best-effort).

2. **Manual refresh (Dashboard button)**
   - Shows the logo loading overlay immediately.
   - If the backend returns `already_running`, the overlay is dismissed and the UI tracks the existing job.

### Job status source of truth

- Refresh creates a job doc under `jobs/{jobId}`.
- The Dashboard button becomes **Running…** (disabled) when the tracked job’s `status` is `running`.

Client implementation:

- JobId runtime store (session-scoped): `src/lib/refresh/refreshRuntime.ts`
- Firestore subscription hook: `src/lib/refresh/useRefreshJobStatus.ts`

---

## 3) Firestore rules

Client reads are allowlisted (email allowlist) and client writes remain blocked.

Relevant paths:

- `snapshots/{docId}`
- `snapshots/{docId}/metricBreakdowns/{metricKey}`
- `dashboard/latest`
- `jobs/{jobId}`

---

## 4) Acceptance checklist

- Hovering a KPI card with a breakdown shows a tooltip with a breakdown list.
- Hovering a KPI card without a breakdown does not show misleading content.
- Auto-refresh runs once per session (after auth) without blocking the UI.
- Dashboard Refresh button shows **Running…** while a refresh job is active and becomes clickable again when it finishes.
- Manual refresh still shows the logo overlay.
