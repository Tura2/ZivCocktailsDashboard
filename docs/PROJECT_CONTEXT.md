# Ziv Cocktails — Desktop Business Dashboard

**Stack:** Electron + React + Vite + TypeScript + Tailwind + Firebase (Auth + Firestore)

Related docs:

- Index / reading order: [CONTEXT_INDEX.md](CONTEXT_INDEX.md)
- ClickUp IDs & field mappings: [DATA_CONTRACT.md](DATA_CONTRACT.md)
- Metric definitions & formulas: [METRICS_SPEC.md](METRICS_SPEC.md)
- Feature plan: [ROADMAP.md](ROADMAP.md)

## 1) Purpose (What this product is)

Ziv Cocktails Desktop App is a **read-only** business intelligence dashboard for a **single business** (Ziv Cocktails).

It provides:

- A fast, reliable dashboard based on **ClickUp + Instagram** data.
- **Monthly historical snapshots** for business review.
- **Integrity verification** for existing Zapier automations.
- Professional access via **email invitation**.

Hard rule: the app **does not modify business data**. It only **reads, computes, verifies, snapshots, and exports**.

Multi-user model:

- There is **one shared workspace**.
- All invited users see the **same data** and the **same dashboard**.

## 2) Core Principles (Non-negotiables)

- **Single source of truth:** ClickUp (lists + tasks)
- **Computed-only storage:** Firestore stores computed outputs (no raw ClickUp mirroring)
- **Code-first logic:** calculations live in code (not editable configs)
- **Security-first:** API keys never live in Electron
- **Fast UX:** precomputed dashboard + cached snapshots
- **Deterministic history:** monthly snapshots never change retroactively

## 3) Architecture (Hybrid Desktop + Cloud)

### Why hybrid

- API keys must be protected.
- Snapshots must run even if the app was closed for weeks.
- Calculations should be consistent across machines.

### Components

#### Desktop (Electron)

- UI only (React + Tailwind)
- Auth via Firebase
- Reads Firestore documents
- Triggers cloud jobs (refresh / checks)
- Exports data (CSV / PDF / Excel)
- Shows job status & logs

#### Cloud (Firebase / GCP)

- Fetches ClickUp API + Instagram Graph API
- Computes dashboard metrics
- Generates monthly snapshots
- Runs Zapier integrity checks
- Stores results in Firestore
- Stores secrets securely (Secret Manager / env)

## 4) Pages & Navigation (Single window)

### 4.1 Dashboard (Main)

Data:

- Loads the latest **precomputed** dashboard from Firestore.

Shows:

- KPI cards
- Charts (defined later)
- Last updated timestamp
- Data freshness indicator

Actions:

- **Refresh Dashboard** → triggers compute job

Behavior:

- Must load fast (no heavy client-side calculations)
- If offline → show offline screen

### 4.2 History

Shows:

- Monthly snapshots list (`YYYY-MM`)

Each snapshot includes:

- Full metric set
- Percentage diff vs previous month

Actions:

- Export CSV
- Export Excel
- Export PDF

Rule:

- Snapshots are **immutable**.

### 4.3 Scripts / Integrity Checks

UI exists / logic will exist (placeholder currently).

Shows:

- Last check run
- Status (OK / Warning / Error)
- Logs summary

Actions:

- **Run checks** (manual trigger)

Purpose:

- Verify Zapier data migration correctness.

## 5) Authentication & Access Control

Auth:

- Firebase Auth (email invitation)

All users can:

- Read dashboard
- Trigger refresh
- Trigger checks
- Export data

No role separation (for now).

Firestore rules:

- Only authenticated, allowed emails can read data.
- No client-side writes to business data collections.

Allowlist model (locked):

- Firestore doc: `access/allowlist`
- Field: `emails: array<string>`
- Read is allowed only if `request.auth.token.email` is in that array.

## 6) Data Sources & Storage Rules

### Sources of truth

- ClickUp: lists + tasks
- Instagram Graph API: engagement metrics

### What is NOT stored

- Raw ClickUp tasks
- Raw Instagram events

### What IS stored

- Computed dashboard metrics
- Monthly snapshot metrics
- Job metadata & logs

## 7) Firestore Data Model (Conceptual)

```text
dashboard/
  latest
    metrics: { ... }
    computedAt
    version

snapshots/
  2024-11
    metrics: { ... }
    diffFromPrevious: { ... }
    computedAt

jobs/
  {jobId}
    type: dashboard_refresh | snapshot | checks
    status: running | success | error
    startedAt
    finishedAt
    logs[]
```

## 8) Monthly Snapshots Logic (Critical Rule)

Invariants:

- Snapshots are **monthly**.
- A snapshot always represents the **full previous calendar month**.
- There is **no snapshot for the current month**.
- Snapshots are **auto-generated on refresh**.
- Missing snapshots can be generated **retroactively**.
- Once written, snapshots are **immutable**.

Example:

- App opened on 15.12
- Last snapshot = 2024-10
- System auto-creates snapshot for 2024-11

## 9) Integrity Checks (Zapier Verification)

Checks cover:

- Completeness (missing records)
- Correctness (invalid or malformed fields)
- Duplicates
- Stale data (not updated in X time)
- Cross-system reconciliation (e.g., iCount totals vs ClickUp totals)

Results:

- Stored as job logs
- Visible in Scripts page
- No auto-fix (read-only system)

## 10) Offline Behavior

If Firebase/Auth is unreachable:

- App shows offline state
- No cached data is shown
- No actions allowed

Once online:

- App checks for missing snapshots
- Runs required snapshot jobs automatically

## 11) Exports

Required formats:

- CSV
- Excel
- PDF

Export source:

- Snapshot data (by month)
- Includes percentage diffs
- Export reflects stable snapshot (not live recalculation)

## 12) Technology Stack

### Desktop

- Electron
- React
- Vite
- TypeScript
- Tailwind CSS

### Backend / Cloud

- Firebase Auth
- Firestore
- Cloud Functions / Cloud Run
- Secret Manager (preferred)

### Distribution

- Windows EXE
- Manual install (auto-update may come later)

## 13) Non-Goals (Important)

- No data editing
- No real-time collaboration
- No per-client multi-tenancy (yet)
- No dashboard customization by users
- No mobile/web version (desktop only)

## 14) Future-Ready (But Not Now)

- Role separation (viewer vs admin)
- Multiple workspaces
- Scheduled background checks
- Auto-update
- Config-driven metrics
