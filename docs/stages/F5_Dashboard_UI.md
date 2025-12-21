# F5 — Dashboard UI (Main Value)

## 1) Stage Summary (what F5 adds)

F5 delivers the **main dashboard UI** backed by Firestore:

- Reads `dashboard/latest` as the **primary and required** data source
- Renders KPI cards grouped by category (financial / marketing / sales / operations)
- Shows simple charts driven directly from `dashboard/latest`
- Displays a "Last updated" timestamp from `dashboard/latest.computedAt`
- Adds a Refresh button that triggers the existing HTTPS `refresh` Cloud Function

---

## 2) Goals and Non-Goals

**Goals**

- Render business KPIs at a glance from `dashboard/latest`.
- Provide a minimal chart view that is **data-driven** from the same document.
- Provide a manual Refresh trigger that causes the backend job to recompute and update Firestore.

**Non-Goals (explicitly out of scope for F5)**

- History UI, month selectors, date-range selectors
- Advanced snapshot logic or any dependency on `snapshots/*` as a core data source
- Any client-side recomputation/transformation of metrics (no reshaping, no recompute)
- Any Firestore writes from the renderer (reads only; refresh happens via HTTPS function)

---

## 3) UX Flows

### Open dashboard

- User navigates to `#/dashboard` (already protected by F4).
- The page subscribes to `dashboard/latest`.
- UI states:
  - Loading: shows a loading card
  - Empty: shows a "No data at dashboard/latest" message with Refresh option
  - Error: shows Firestore error message
  - Ready: renders KPI sections + charts

### Refresh

- User clicks **Refresh**.
- The app calls the deployed HTTPS function `refresh` with an `Authorization: Bearer <ID_TOKEN>` header.
- The endpoint is configured by `VITE_REFRESH_URL` (prefer the stable `cloudfunctions.net/refresh` URL).
- UI shows "Refreshing…" while the request is in-flight.
- If the request succeeds, UI shows a success message with the job id.
- When the backend writes a new `dashboard/latest`, the subscribed UI updates automatically.

Notes (CORS):

- Because the request uses `Authorization` and JSON, the browser/Electron renderer sends an `OPTIONS` preflight.
- The server-side `refresh` function must return correct CORS headers for both `OPTIONS` and `POST`.

---

## 4) Architecture / Key Files

**Dashboard UI**

- [src/pages/DashboardPage.tsx](../../src/pages/DashboardPage.tsx)
  - Renders KPI sections, charts, last updated, refresh button.

**Firestore read**

- [src/lib/dashboard/useDashboardLatest.ts](../../src/lib/dashboard/useDashboardLatest.ts)
  - Simple `onSnapshot` subscription to `dashboard/latest`.

**Types (mirrors backend)**

- [src/lib/dashboard/types.ts](../../src/lib/dashboard/types.ts)
  - Mirrors [backend/dashboard/types.ts](../../backend/dashboard/types.ts) exactly for `DashboardMetrics`.
  - Adds `DashboardLatestDoc` to match the Firestore document shape `{ version, month, computedAt, metrics }`.

**Refresh call**

- [src/lib/api/refresh.ts](../../src/lib/api/refresh.ts)
  - Calls `VITE_REFRESH_URL` using Firebase ID token.
  - Example: `VITE_REFRESH_URL=https://me-west1-<firebaseProjectId>.cloudfunctions.net/refresh`

---

## 5) Data Contract (what is read)

**Primary required source**

- `dashboard/latest`
  - Fields used:
    - `computedAt`
    - `month`
    - `metrics` (entire `DashboardMetrics` object)

No other collections are required for F5.

---

## 6) Charts (what they represent)

Charts are intentionally simple and purely derived from `dashboard/latest`:

- Financial bar chart: uses
  - `metrics.financial.monthlyRevenue.grossILS`
  - `metrics.financial.expectedCashflow.grossILS`
  - `metrics.financial.expectedExpenses.grossILS`

- Funnel line chart: uses
  - `metrics.marketing.totalLeads.value`
  - `metrics.marketing.relevantLeads.value`
  - `metrics.sales.salesCalls.value`
  - `metrics.sales.closures.value`

No snapshot trend logic is introduced in F5.

---

## 7) Security Notes

- Renderer reads Firestore only.
- Refresh is invoked via HTTPS function and uses the Firebase ID token.
- No ClickUp/Instagram secrets or engine logic exists in the renderer.

---

## 8) Acceptance Criteria Checklist

### "Data reflects Firestore latest dashboard"

- [ ] Ensure Firestore has `dashboard/latest` populated.
- [ ] Open `#/dashboard`.
- [ ] Verify KPI values match `dashboard/latest.metrics`.
- [ ] Verify "Last updated" matches `dashboard/latest.computedAt`.

### Refresh trigger works

- [ ] Click **Refresh**.
- [ ] Verify the request returns success (UI shows job id), or a clear error.
- [ ] After backend completes, verify `dashboard/latest` updates and UI updates without reload.

### How to validate (CORS + runtime)

- [ ] DevTools → Network shows an `OPTIONS` request to refresh returning `204`.
- [ ] `OPTIONS` response headers include:
  - [ ] `Access-Control-Allow-Origin: http://localhost:5173`
  - [ ] `Access-Control-Allow-Methods` includes `POST` and `OPTIONS`
  - [ ] `Access-Control-Allow-Headers` includes `Authorization`, `Content-Type`, `x-dev-email`
- [ ] DevTools → Network then shows a `POST` request returning `200` (or a JSON auth error such as `401/403`, but not a CORS error).
- [ ] Backend logs show both `OPTIONS /refresh` and `POST /refresh`.

---

## 9) Follow-ups (later stages)

- Use `snapshots/*` for true time-series charts (F6).
- Add job status UI (jobs collection) if needed (later stage).
