# F6 — History & Trends (Monthly Snapshots)

## 1) Stage Summary

F6 adds a **History** page (`/history`) that reads monthly snapshot documents from Firestore (`snapshots/{YYYY-MM}`) and renders:

- A default “recent months” view
- Simple month selection (single month or inclusive range)
- KPI groups per month (Financial / Marketing / Sales / Operations)
- Month-over-month (MoM) percentage diffs using the snapshot’s stored `diffFromPreviousPct`
- Trend charts derived from snapshot metrics

This stage is **read-only**: it performs **no Firestore writes** and does **no recomputation** of metrics or diffs.

---

## 2) Goals and Non-Goals

**Goals**

- Use `snapshots/*` as the **source of truth** for monthly history.
- Show the most recent N months by default (implemented as N=6).
- Allow selecting:
  - A single month
  - An inclusive month range
- Display MoM diffs using **stored** `diffFromPreviousPct` (do not recompute).
- Render:
  - At least one line chart from snapshots
  - One additional chart (bar/pie) from snapshots
- Handle:
  - Missing months (gaps)
  - Null metrics (skip null points in charts)
  - Loading / empty / error
  - Offline blocking via the existing F4 shell behavior

**Non-Goals (explicitly out of scope for F6)**

- Exports (CSV / Excel / PDF)
- Any backend changes, scheduling, or refresh orchestration
- Any client-side recomputation of metrics or diffs
- Any Firestore writes from the client

---

## 3) Firestore Queries (what we query and how)

**Primary collection**

- `snapshots` collection
- Documents keyed by month: `snapshots/{YYYY-MM}`

**Query used by the UI**

- List snapshots with:
  - `orderBy('month', 'desc')`
  - `limit(60)`

Notes:

- Month strings are `YYYY-MM`, so lexicographic order matches chronological order.
- Range selection in the UI is computed client-side from the loaded months; missing months are represented explicitly in the UI.

---

## 4) UI Structure (History page layout + components)

**Route**

- `/history` (already in router)

**Top section**

- Page title and short description

**Month selection**

- Two dropdowns:
  - Start month
  - End month (defaults to same as start)
- Reset button

**Trends section**

- A “Trends” card containing:
  - Line chart: revenue gross vs net
  - Bar chart: total leads

**Per-month cards**

- One card per month in the current view
- Each month card renders KPI groups:
  - Financial
  - Marketing
  - Sales
  - Operations

**Missing months**

- If a month in the selected range has no snapshot document, render a month card that states:
  - “Missing snapshot”

---

## 5) Diffs display rules (null handling)

**Source of diffs**

- Always use the snapshot field: `diffFromPreviousPct`
- Never compute diffs in the UI

**Display rules**

- If a diff value is `null`, show `—` and direction `neutral`
- If diff is a number:
  - Round to a whole percent
  - Show a leading `+` for positive values
  - Direction:
    - `up` if > 0
    - `down` if < 0
    - `neutral` if = 0

---

## 6) Charts (series definitions)

Charts are derived directly from the currently viewed months’ snapshot metrics.

**Line chart: Revenue over time**

- X-axis: months in ascending order
- Series:
  - Gross ILS: `metrics.financial.monthlyRevenue.grossILS`
  - Net ILS: `metrics.financial.monthlyRevenue.netILS`

**Bar chart: Total leads**

- X-axis: months in ascending order
- Values:
  - `metrics.marketing.totalLeads.value`

**Null handling**

- Line chart: null points are skipped (segments break across nulls)
- Bar chart: null values display as `—` and render no filled bar

---

## 7) States (loading/empty/error/offline)

- **Offline**: handled by the existing F4 shell (`AppShellLayout` shows the offline screen and blocks route content).
- **Loading**: show a loading card (“Loading `snapshots/*`…”)
- **Empty**: show a friendly message when `snapshots` is empty
- **Error**: show the Firestore error message in a local error card

---

## 8) Acceptance Criteria Checklist (maps to Done when)

- [ ] `/history` loads snapshot months from Firestore and displays grouped KPIs
- [ ] Month selection works (single month and inclusive range)
- [ ] MoM diffs displayed from stored `diffFromPreviousPct` (no recompute)
- [ ] Trend charts render from snapshots
- [ ] Handles missing/null metrics and missing months gracefully
- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] This doc exists: `docs/stages/F6_History_and_Trends.md`

---

## 9) Follow-ups

- Add pagination / virtualization if the snapshot list grows large.
- Add richer charting once a chart library is introduced (keep it optional).
- Consider a dedicated Firestore range query for very large history ranges (instead of relying on a fixed `limit`).
