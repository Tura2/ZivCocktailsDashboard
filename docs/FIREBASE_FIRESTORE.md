# Firebase + Firestore in This Project

This project uses Firebase for:
- **Authentication** (Firebase Auth) — who can access the dashboard.
- **Firestore** — the *read-only* data store for the UI (snapshots, latest dashboard, refresh jobs).
- **Cloud Functions** — the only component allowed to **compute** and **write** Firestore documents.

The central persistence unit is a **monthly snapshot** document at:

- `snapshots/{YYYY-MM}`

A snapshot stores the computed metrics for a month, plus percentage diffs versus the previous snapshot.

---

## 1) What writes to Firestore (and what does not)

### Client app (Vite/React)
- **Reads Firestore** (`snapshots/*`, `dashboard/latest`, `jobs/*`).
- **Never writes Firestore**.
- Triggers computation via an **HTTP Cloud Function** (`refresh`) using a Firebase Auth ID token.

Frontend entry points:
- Firebase init: `src/lib/firebase.ts`
- Read snapshots: `src/lib/snapshots/useSnapshots.ts`
- Read latest dashboard: `src/lib/dashboard/useDashboardLatest.ts`
- Trigger refresh (HTTP): `src/lib/api/refresh.ts`

### Cloud Functions
- The HTTP function `refresh`:
  - Reads ClickUp + Instagram (optional)
  - Computes metrics
  - Writes Firestore documents

Function entry points:
- HTTP function: `functions/src/refresh.ts`
- Auth/allowlist guard: `functions/src/refresh/authz.ts`
- Refresh handler: `functions/src/refresh/refreshHandler.ts`
- Firestore write logic: `functions/src/refresh/runRefresh.ts`

### Backend “engine” code (shared logic)
The metric computations live under `backend/` (the “engine”).
During the Functions build, this engine is copied into `functions/engine/**` and required from there.

Key engine modules:
- Snapshot generation: `backend/snapshots/generateSnapshotRecords.ts`
- Snapshot diffs: `backend/snapshots/diff.ts`
- Dashboard computation: `backend/dashboard/computeDashboard.ts`
- Metric calculators: `backend/metrics/*.ts`

---

## 2) Firestore security model

Firestore rules are in `firestore.rules`.

### Allowlist gating
Access is restricted to authenticated users whose **email** appears in:

- `access/allowlist` with field `emails: string[]`

This allowlist is enforced twice:
1. **In Firestore rules** (for read access)
2. **In the refresh HTTP function** (server-side, before any writes)

That means:
- If you are not allowlisted, you can’t read Firestore.
- If you are not allowlisted, you can’t run `refresh`.

### Client writes are blocked
The client is blocked from writing `snapshots/*`, `dashboard/*`, and `jobs/*`.
Only server-side Admin SDK writes from Cloud Functions can modify these collections.

---

## 3) Firestore collections and document shapes

### 3.1 `snapshots/{YYYY-MM}` (immutable monthly snapshots)
Written by: `functions/src/refresh/runRefresh.ts` using `ref.create(...)`.

Properties:
- **Immutable by design**: uses `create()` so it fails if the document exists.
- **Idempotent refresh**: if the snapshot doc already exists, refresh skips it.
- **Backfills**: refresh can create multiple missing months in one run.

Document schema (v1):
```ts
{
  version: 'v1',
  month: 'YYYY-MM',
  computedAt: string, // ISO timestamp
  metrics: DashboardMetrics,
  diffFromPreviousPct: DiffObject
}
```
The client’s type alias matches this shape:
- `src/lib/snapshots/types.ts` (`SnapshotDoc` / `SnapshotRecord`)

#### `metrics: DashboardMetrics`
This is the “payload” that the UI renders and the export engine exports.

Schema (high level):
```ts
metrics: {
  version: 'v1',
  month: 'YYYY-MM',
  computedAt: string,
  financial: { ... },
  marketing: { ... },
  sales: { ... },
  operations: { ... }
}
```
Each leaf metric includes:
- a value (`grossILS`/`netILS` or `value`)
- a `meta` object with:
  - `source: 'clickup' | 'instagram' | 'computed'`
  - optional `notes: string[]`

Definitions:
- Frontend: `src/lib/dashboard/types.ts`
- Backend (engine): `backend/dashboard/types.ts`

#### `diffFromPreviousPct: DiffObject`
Computed by `backend/snapshots/diff.ts`.

Formula:

$$\Delta\% = \frac{(current - previous)}{previous} \cdot 100$$

Rules:
- If `previous` is `null` or `0` → `null`
- If `current` is `null` → `null`
- Rounded to **2 decimals**

If there is **no previous snapshot**, diffs are forced to **all null**.

---

### 3.2 `dashboard/latest` (current dashboard view)
Written by: `functions/src/refresh/runRefresh.ts`.

This is always overwritten on refresh (not immutable):
```ts
{
  version: 'v1',
  month: 'YYYY-MM',
  computedAt: string, // ISO
  metrics: DashboardMetrics
}
```

The UI subscribes to this single doc:
- `src/lib/dashboard/useDashboardLatest.ts`

---

### 3.3 `jobs/{jobId}` (refresh job tracking)
Written by:
- Create job: `functions/src/refresh/jobs.ts` (`createJob`)
- Append logs: `appendJobLog` (transactional, capped)
- Mark success/error: `markJobSuccess` / `markJobError`

Document schema:
```ts
{
  type: 'refresh',
  status: 'running' | 'success' | 'error',
  startedAt: serverTimestamp,
  finishedAt?: serverTimestamp,
  requestedByEmail: string,
  targetMonth: string,
  writtenSnapshots: string[],
  skippedSnapshots: string[],
  logs: string[],
  error?: { message: string; code?: string }
}
```

---

### 3.4 `jobs_lock/refresh` (server-side mutex)
Written by: `functions/src/refresh/lock.ts`.

Used to prevent concurrent refresh runs.
It has a TTL so a crash won’t block refresh forever.

---

### 3.5 `employees/*` (Payroll / Salaries)

The Salaries module persists per-employee defaults and per-month payment snapshots.

Important:
- The client UI does **not** write Firestore directly.
- Cloud Functions (Admin SDK) are the only writers.
- Access to call the HTTP functions is gated by the same allowlist model:
  - `access/allowlist` with field `emails: string[]`

Collections:

- `employees/{staffTaskId}`
  - Stores per-employee defaults.
  - Fields:
    - `baseRate: number`
    - `videoRate: number` (ILS per recommendation video, default 50)
    - `currentBalance: number` (ILS, running balance)

- `employees/{staffTaskId}/payments/{YYYY_MM}`
  - Stores the monthly snapshot (doc id uses underscore, e.g. `2026_01`).
  - Fields include:
    - `month: 'YYYY-MM'`
    - `baseRate: number`
    - `videosCount: number`
    - `videoRate: number`
    - `bonus: number`
    - `eventCount: number`
    - `eventsTotal: number`
    - `videosTotal: number`
    - `total: number`
    - `events: Array<{ taskId: string; name: string; requestedDateMs: number; recommendation: boolean | null }>`
    - `status: 'unpaid' | 'partial' | 'paid'`
    - `updatedAt: string` (ISO)

  - When the previous-month “Monthly Summary” is accepted, the same doc is also marked as processed:
    - `processedAt: string` (ISO)
    - `processedAmount: number`
    - `processedByEmail: string`
    - `balanceAfterAccrual: number`

- `employees/{staffTaskId}/payments/{autoId}`
  - Stores a payment transaction record (not a monthly snapshot).
  - This is distinguished by:
    - `type: 'payment'`
  - Fields include:
    - `amount: number`
    - `createdAt: string` (ISO)
    - `createdByEmail: string`
    - `balanceAfter: number`

Notes:
- `videosCount` is derived from ClickUp by counting events where the Event Calendar `Recommendation` checkbox is checked.
  - It is persisted in the monthly payment snapshot for audit/consistency.
- `videoRate` is the user-editable value (₪ per recommendation video). It is stored both:
  - on the employee doc as the default for future months
  - on the monthly snapshot doc for historical accuracy

Index requirements

- The `salaryHistory` HTTP function queries payment transactions using:
  - `employees/{staffTaskId}/payments` (collection group)
  - `where('type', '==', 'payment')`
  - `orderBy('createdAt', 'desc')`
- Firestore requires a composite index for this query.
  - Collection group: `payments`
  - Fields:
    - `type` Asc
    - `createdAt` Desc
  - (Firestore will also include `__name__` for tie-breaking automatically.)

Do you need to create anything manually?
- No: Firestore is schemaless; the functions will create these docs on first Save.
- Optional: if you want default rates pre-populated before anyone presses Save, you can seed `employees/{staffTaskId}.baseRate`.

---

## 4) How snapshot months are chosen

Refresh chooses a `targetMonth`:
- If request body has `targetMonth`, it validates it.
- Else it calls `engineMonthLogic.getTargetSnapshotMonth(now)`.

Then it queries Firestore for the latest snapshot month and generates any missing months.
Relevant code:
- Firestore read: `functions/src/refresh/runRefresh.ts` (`getLastSnapshotMonth`)
- Month logic: `backend/snapshots/monthLogic.ts`

---

## 5) Snapshot fields: what they mean and how they are computed

The snapshot fields you care about most are under:

- `snapshots/{YYYY-MM}.metrics`

The canonical “routing” is:

- `backend/dashboard/computeDashboard.ts` (orchestrator)
  - fetches ClickUp lists
  - normalizes records
  - calls each `compute*Metrics` module

### 5.1 Financial
Computed by: `backend/metrics/financial.ts` (`computeFinancialMetrics`)

#### `metrics.financial.monthlyRevenue`
- **Source:** ClickUp (`Incoming Leads`)
- **Rule:** Sum budgets for deals with `status == Closed Won` and `closeDate ∈ month`.
- **Close date fallback:** if `date_closed` missing, uses `date_updated` (adds a note).
- **VAT:** treats ClickUp Budget as **gross ILS**, computes net using VAT 18%.

#### `metrics.financial.expectedCashflow`
- **Source:** ClickUp (`Incoming Leads`)
- Implements the conditional logic from `docs/METRICS_SPEC.md` using the available fields:
  - `requestedDate` as event date proxy
  - `Paid Amount` as deposit (gross)
  - close date as deposit date proxy

Rules (v1):
1. Closed this month + event this month → full amount
2. Closed earlier + event this month → full amount minus deposit already paid
3. Deposit paid this month (even if event future) → deposit
4. `status == Billing` → excluded

VAT: gross → net computed at 18%.

#### `metrics.financial.expectedExpenses`
- **Source:** ClickUp (`Expenses`)
- **Rule:** Sum `Expense Amount` for expenses whose `expenseDate ∈ month`.
- **VAT:** treats amount as gross ILS, computes net at 18%.

---

### 5.2 Marketing
Core computed by: `backend/metrics/marketing.ts` (`computeMarketingMetrics`)
Followers computed by: `backend/dashboard/computeDashboard.ts`

#### `metrics.marketing.totalLeads`
- **Source:** ClickUp
- **Rule:** Count Incoming Leads tasks created in month.

#### `metrics.marketing.relevantLeads`
- **Source:** ClickUp
- **Rule:** `totalLeads` minus leads that are:
  - `status == Closed Loss` AND `lossReason == Not Relevant`

#### `metrics.marketing.landingVisits`
- **Source:** ClickUp (proxy)
- **Rule:** Count leads created in month where `Source == Landing Page`.

#### `metrics.marketing.landingSignups`
- **Source:** ClickUp
- **Rule (v1):** equals `landingVisits` (ClickUp treated as authoritative).

#### `metrics.marketing.landingConversionPct`
- **Source:** computed
- **Rule (v1):** `landingSignups / landingVisits * 100`.
- Because v1 sets `landingSignups == landingVisits`, this evaluates to:
  - `null` if `landingVisits == 0`
  - otherwise `100`

#### `metrics.marketing.followersEndOfMonth`
- **Source:** Instagram Graph API
- **Rule:** For supported months, pick the latest follower_count sample within the month window.

#### `metrics.marketing.followersDeltaMonth`
- **Source:** Instagram Graph API + computed
- **Rule:** Only computed for the *current* month:
  - `followersEndOfMonth(currentMonth) - followersEndOfMonth(previousMonth)`
- Otherwise stored as `null` with an explanatory note.

Constraints:
- Followers are only supported for the **current** and **previous** month relative to `computedAt`, due to the insights window.

---

### 5.3 Sales
Computed by: `backend/metrics/sales.ts` (`computeSalesMetrics`)

#### `metrics.sales.salesCalls`
- **Source:** ClickUp
- **Rule:** Count leads created in month where `status != New Lead`.

#### `metrics.sales.closures`
- **Source:** ClickUp
- **Rule:** Count deals with `status == Closed Won` and close date in month.
- Close date fallback: `date_closed ?? date_updated`.

#### `metrics.sales.avgRevenuePerDeal`
- **Source:** computed
- **Rule:** `monthlyRevenue / closuresCount`.
- If `closuresCount == 0` or revenue is missing → null.

#### `metrics.sales.closeRatePct`
- **Source:** computed
- **Rule:** `(closures / salesCalls) * 100`.
- If `salesCalls == 0` → null.

---

### 5.4 Operations
Computed by: `backend/metrics/operations.ts` (`computeOperationsMetrics`)

#### `metrics.operations.activeCustomers`
- **Source:** ClickUp (`Event Calendar`)
- **Rule:** Count event tasks where:
  - status ∈ {booked, staffing, logistics, ready}
  - event date (`requestedDate`) >= `computedAt`

#### `metrics.operations.cancellations`
- **Source:** ClickUp
- **Rule (v1):** count events where:
  - current status == Cancelled
  - `date_updated ∈ month`

#### `metrics.operations.referralsWordOfMouth`
- **Source:** ClickUp
- **Rule:** count leads created in month where `Source == Word of Mouth`.

#### `metrics.operations.returningCustomers`
- **Source:** ClickUp + computed
- **Rule:**
  - Build a set of **historical Closed Won** customer phones (normalized), strictly before the month start.
  - Count unique normalized phones for leads created in month that appear in the historical set.

Phone normalization lives under:
- `backend/normalize/phone.ts`

---

## 6) How the export engine relates

The export engine (F7) exports a **single Firestore snapshot document** (`snapshots/{YYYY-MM}`) to CSV/PDF/XLSX.
It treats the snapshot document as the source of truth for exports.

See:
- `docs/stages/F7_Export_Engine.md`
- `src/export/*`

---

## 7) Pointers to the authoritative specs

- ClickUp IDs and mappings: `docs/DATA_CONTRACT.md`
- Metric definitions: `docs/METRICS_SPEC.md`

If you change any computation logic, update the relevant spec and ensure snapshot fixtures/tests still pass.
