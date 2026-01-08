# F9 — Payroll & Salaries (ClickUp + Firestore)

**Goal:** A clean Salaries module that:

- Fetches employees from ClickUp **Staff Directory**
- Computes monthly **events per employee** from ClickUp **Event Calendar** (status = `done` or `billing`)
- Lets the user edit & save payroll inputs (`baseRate`, `videoRate`, `bonus`)
- Persists per-employee defaults + per-month payment snapshots to Firestore

---

## 1) Data sources (ClickUp)

Locked identifiers (from [docs/EMPLOYER_EVENTS_CALC.md](../EMPLOYER_EVENTS_CALC.md)):

- Event Calendar list: `901214362128`
- Staff Directory list: `901214362129`
- Assigned Staff (relationship) field: `61f29c83-d538-4d62-97bb-c221572d2c47`
- Requested Date (date, ms) field: `1660701a-1263-41cf-bb7a-79e3c3638aa3`
- Recommendation (checkbox) field: `f11a51df-9a01-4eea-8d2f-dab88217d985`
- Staff phone field (space field): `b9781217-a9fc-44e1-b152-c11f193c8839`

---

## 2) Monthly computation rules (must match script)

For each Event Calendar task:

1. Status filter: count only tasks where `task.status.status` equals `done` or `billing` (case-insensitive)
1. Relationship filter: read the Assigned Staff custom field and extract linked staff task IDs
1. Date filter: read Requested Date (ms); if missing, skip the event
1. Recommendation flag: read the Recommendation checkbox and store per event as `recommendation: true/false/null`
1. Month grouping: convert Requested Date to month key `YYYY-MM` (default timezone `Asia/Jerusalem`)
1. Counting: for every linked staff ID, `(staffId, month) += 1`

---

## 3) Salary formula

Per employee for a month:

- `eventsTotal = eventCount * baseRate`
- `videosTotal = videosCount * videoRate`
- `total = eventsTotal + videosTotal + bonus`

Only the user can edit:

- `baseRate`
- `videoRate` (₪ per recommendation video, default 50)
- `bonus`

Defaulting rule:

- `videosCount` is derived from ClickUp as `count(events where recommendation === true)`.
- The UI treats `videosCount` as read-only.
- `videoRate` defaults to 50 (or the saved employee/month snapshot value when present).

---

## 4) Firestore persistence

Collections:

### `employees/{staffTaskId}`

Stores per-employee defaults.

Fields:

- `baseRate: number` (default for future months)
- `videoRate: number` (default ₪/vid for future months)
- `currentBalance: number` (running ILS balance)

### `employees/{staffTaskId}/payments/{YYYY_MM}`

Stores the monthly snapshot.

Fields:

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

Processed markers (set when a month is accepted into the running balance):

- `processedAt: string` (ISO)
- `processedAmount: number`
- `processedByEmail: string`
- `balanceAfterAccrual: number`

### `employees/{staffTaskId}/payments/{autoId}`

Stores a payment transaction (distinct from the monthly snapshot docs).

Fields:

- `type: 'payment'`
- `amount: number`
- `createdAt: string` (ISO)
- `createdByEmail: string`
- `balanceAfter: number`

Redundant write prevention:

- Saving does **not** write if nothing changed.
- Implementation: compare current stored values vs incoming payload and only commit a batch when something differs.

---

## 5) Cloud Functions

### `salaries` (read/compute)

- Input: `{ month: 'YYYY-MM', timezone?: string }`
- Output: monthly rows (employee + phone + event list + computed totals + stored payroll inputs)

### `salarySave` (persist)

Input: `{ month, staffTaskId, baseRate, videosCount, videoRate, bonus, status?, events? }`

Writes:

- `employees/{id}.baseRate` when changed
- `employees/{id}.videoRate` when changed
- `employees/{id}/payments/{YYYY_MM}` when changed

Auth:

- Endpoints require Firebase Auth (Bearer token) + allowlisted email.

### `salaryAccept` (accrue previous month)

Input: `{ month, staffTaskId, baseRate, videosCount, videoRate, bonus, events? }`

Transactionally:

- Prevents double-processing if `processedAt` already exists
- Adds `total` to `employees/{id}.currentBalance`
- Marks the month doc as processed

### `salaryPay` (record payment)

Input: `{ staffTaskId, amount }`

Transactionally:

- Subtracts from `currentBalance` (rejects overpay)
- Writes a `type:'payment'` transaction doc in `employees/{id}/payments/{autoId}`

### `salaryHistory` (read payment transactions)

- Input: `{ staffTaskId, limit? }`
- Returns payment transaction docs (latest-first)

---

## 6) Frontend page

Route:

- `#/salaries`

UI:

- Per-employee "Collapse Card" with closed summary + expanded details
- Edit mode shows inline inputs + bonus
- Shows `currentBalance` and a “Pay” action
- Expanded view includes payment transaction history + event list
- Monthly Summary (previous month only): collapsible card (default collapsed) with “Accept” to accrue into `currentBalance`

---

## 7) Deployment checklist

1. Ensure secrets exist in Secret Manager: `CLICKUP_API_TOKEN`
1. Ensure allowlist doc exists: Firestore doc `access/allowlist` with field `emails: string[]`
1. Deploy Cloud Functions: `salaries`, `salarySave`, `salaryAccept`, `salaryPay`, `salaryHistory`
1. Configure renderer env vars: `VITE_SALARIES_URL`, `VITE_SALARY_SAVE_URL`, `VITE_SALARY_ACCEPT_URL`, `VITE_SALARY_PAY_URL`, `VITE_SALARY_HISTORY_URL`

Done when:

- Salaries page loads a month successfully
- Tooltip shows event names
- Editing + Save updates Firestore
- Save with no changes performs no write
