# F9 — Payroll & Salaries (ClickUp + Firestore)

**Goal:** A clean Salaries module that:

- Fetches employees from ClickUp **Staff Directory**
- Computes monthly **events per employee** from ClickUp **Event Calendar** (status = `done` only)
- Lets the user edit & save payroll inputs (base rate, videos count, bonus)
- Persists per-employee defaults + per-month payment snapshots to Firestore

---

## 1) Data sources (ClickUp)

Locked identifiers (from [docs/EMPLOYER_EVENTS_CALC.md](../EMPLOYER_EVENTS_CALC.md)):

- Lists
  - Event Calendar: `901214362128`
  - Staff Directory: `901214362129`

- Event Calendar fields

| Field | ID |
| ------ | ---- |
| Assigned Staff (relationship) | `61f29c83-d538-4d62-97bb-c221572d2c47` |
| Requested Date (date, ms) | `1660701a-1263-41cf-bb7a-79e3c3638aa3` |
| Recommendation (checkbox) | `f11a51df-9a01-4eea-8d2f-dab88217d985` |

- Staff phone field
  - Phone (space field): `b9781217-a9fc-44e1-b152-c11f193c8839`

---

## 2) Monthly computation rules (must match script)

For each Event Calendar task:

1. Status filter
   - Count only tasks where `task.status.status` equals `done` (case-insensitive)

1. Relationship filter
   - Read `Assigned Staff` custom field value
   - Extract linked staff task IDs (handles strings and objects with `{ id }`)

1. Date filter
   - Read `Requested Date` (ms)
   - If missing, skip the event
   - Read the `Recommendation` checkbox
   - Included per event as `recommendation: true/false/null`

1. Month grouping
   - Convert `Requested Date` to month key `YYYY-MM`
   - Default timezone: `Asia/Jerusalem`

1. Counting
   - For every linked staff ID: `(staffId, month) += 1`

---

## 3) Salary formula

Per employee for a month:

- `eventsTotal = eventCount * baseRate`
- `videosTotal = videosCount * 50`
- `total = eventsTotal + videosTotal + bonus`

Only the user can edit:

- `baseRate`
- `videosCount`
- `bonus`

Defaulting rule:

- If there is **no saved** monthly snapshot value for `videosCount`, the backend defaults it to `count(events where recommendation === true)`.
- If a snapshot exists, its `videosCount` is used (manual override).

---

## 4) Firestore persistence

### Collections

- `employees/{staffTaskId}`
  - Stores per-employee defaults
  - Fields:
    - `baseRate: number` (default for future months)

- `employees/{staffTaskId}/payments/{YYYY_MM}`
  - Stores the monthly snapshot
  - Fields:
    - `month: 'YYYY-MM'`
    - `baseRate: number`
    - `videosCount: number`
    - `bonus: number`
    - `eventCount: number`
    - `eventsTotal: number`
    - `videosTotal: number`
    - `total: number`
      - `events: Array<{ taskId: string; name: string; requestedDateMs: number; recommendation: boolean | null }>`
    - `status: 'unpaid' | 'partial' | 'paid'`
    - `updatedAt: string` (ISO)

### Redundant write prevention

- Saving does **not** write if nothing changed.
- Implementation: compare current stored values vs incoming payload and only commit a batch when something differs.

---

## 5) Cloud Functions

### `salaries` (read/compute)

- Input: `{ month: 'YYYY-MM', timezone?: string }`
- Output: monthly rows (employee + phone + event list + computed totals + stored payroll inputs)

### `salarySave` (persist)

- Input: `{ month, staffTaskId, baseRate, videosCount, bonus, status?, events? }`
- Writes:
  - `employees/{id}.baseRate` when changed
  - `employees/{id}/payments/{YYYY_MM}` when changed

Auth:

- Both endpoints require Firebase Auth (Bearer token) + allowlisted email.

---

## 6) Frontend page

Route:

- `#/salaries`

UI:

- "Collapse Card" per employee
  - Closed state: summary row
  - Edit mode: inline inputs + bonus
  - Expanded: payment history placeholder + event list

---

## 7) Deployment checklist

1. Ensure secrets exist in Secret Manager:
   - `CLICKUP_API_TOKEN`

2. Ensure allowlist doc exists:
   - Firestore doc: `access/allowlist`
   - Field: `emails: string[]`

3. Deploy Cloud Functions:
   - `salaries`
   - `salarySave`

4. Configure renderer env vars:
   - `VITE_SALARIES_URL`
   - `VITE_SALARY_SAVE_URL`

Done when:

- Salaries page loads a month successfully
- Tooltip shows event names
- Editing + Save updates Firestore
- Save with no changes performs no write
