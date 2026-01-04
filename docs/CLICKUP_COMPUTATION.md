# ClickUp Computation Guide (v1)

This document explains how **ClickUp tasks + custom fields** are turned into the dashboard’s computed monthly metrics.

Scope:

- ClickUp inputs: lists, task fields, statuses, custom fields
- Normalization rules (how raw ClickUp JSON becomes typed inputs)
- Metric formulas that consume ClickUp-derived inputs

Out of scope:

- Firestore persistence / snapshot diff engine (see `docs/FIREBASE_FIRESTORE.md` and `docs/METRICS_SPEC.md`)

## Data flow (high level)

1. Fetch ClickUp tasks from three lists:
   - Incoming Leads
   - Event Calendar
   - Expenses
2. Normalize tasks into typed records:
   - `NormalizedLead`
   - `NormalizedEvent`
   - `NormalizedExpense`
3. Compute metrics for a target month `YYYY-MM` using the month range `[startMs, endExclusiveMs)`.

Code entry point:

- Engine orchestrator: `backend/dashboard/computeDashboard.ts`

## ClickUp lists (IDs)

Defined in `backend/config/dataContract.ts` (`CLICKUP.lists`).

- **Incoming Leads**: `CLICKUP.lists.incomingLeads`
- **Event Calendar**: `CLICKUP.lists.eventCalendar`
- **Expenses**: `CLICKUP.lists.expenses`

Fetch helpers:

- `backend/clickup/fetchLists.ts`

## Normalization (raw task → normalized record)

All ClickUp computations use the normalized shapes from `backend/normalize/clickup.ts`.

### Common parsing

- Task timestamps are parsed from ClickUp’s `date_*` string fields (milliseconds since epoch as a string):
  - `createdMs` from `task.date_created`
  - `updatedMs` from `task.date_updated`
  - `closedMs` from `task.date_closed` (nullable)
- Custom field extraction is done by ID (`CLICKUP.fields.*`).
- Dropdown custom fields (ClickUp type `drop_down`):
  - ClickUp can return the value as a **number** (option index/order) instead of a string.
  - The engine normalizes dropdowns to the **option name** using the field’s `type_config.options`.
  - This matters for fields like `source` and `lossReason`, which are compared against names like `Landing Page`, `Word of Mouth`, `Not Relevant`.
- Numbers:
  - If the custom field value is a number → used as-is
  - If the value is a string (ClickUp sometimes does this for currency) → `Number(value)` is attempted
- Dates:
  - Custom date fields are treated as **milliseconds since epoch**.
- Phone:
  - `phoneNormalized = normalizePhone(rawPhone)`

### NormalizedLead (Incoming Leads)

Produced by `normalizeIncomingLead(task)`.

Fields:

- `id`: `task.id`
- `status`: `task.status.status`
- `createdMs`: parsed from `task.date_created`
- `updatedMs`: parsed from `task.date_updated`
- `closedMs`: parsed from `task.date_closed` (may be null)
- `phoneNormalized`: from custom field `CLICKUP.fields.phone` → `normalizePhone(...)`
- `source`: from custom field `CLICKUP.fields.source`
- `lossReason`: from custom field `CLICKUP.fields.lossReason`
- `budgetGrossILS`: from custom field `CLICKUP.fields.budget`
- `paidAmountGrossILS`: from custom field `CLICKUP.fields.paidAmount`
- `requestedDateMs`: from custom field `CLICKUP.fields.requestedDate` (used as “event date proxy”)

### NormalizedEvent (Event Calendar)

Produced by `normalizeEvent(task)`.

Fields:

- `id`: `task.id`
- `status`: `task.status.status`
- `updatedMs`: parsed from `task.date_updated`
- `requestedDateMs`: from custom field `CLICKUP.fields.requestedDate` (event date)
- `phoneNormalized`: from `CLICKUP.fields.phone` → `normalizePhone(...)`

### NormalizedExpense (Expenses)

Produced by `normalizeExpense(task)`.

Fields:

- `id`: `task.id`
- `expenseDateMs`: from custom field `CLICKUP.fields.expenseDate`
- `amountGrossILS`: from custom field `CLICKUP.fields.expenseAmount`

## ClickUp fields (what they affect)

Field IDs are locked in `backend/config/dataContract.ts` (`CLICKUP.fields`).

### Incoming Leads list fields

- **Phone** (`CLICKUP.fields.phone`)
  - Used by: Operations → `returningCustomers` (phone matching)
  - Also used indirectly as normalization input

- **Source** (`CLICKUP.fields.source`)
  - Used by:
    - Marketing → `landingVisits` / `landingSignups`
    - Operations → `referralsWordOfMouth`

- **Loss Reason** (`CLICKUP.fields.lossReason`)
  - Used by: Marketing → `relevantLeads` (filters out “Not Relevant” losses)

- **Budget** (`CLICKUP.fields.budget`)
  - Used by: Financial → `monthlyRevenue`, `expectedCashflow`
  - Treated as **gross ILS** in v1; net is computed using VAT 18%

- **Paid Amount** (`CLICKUP.fields.paidAmount`)
  - Used by: Financial → `expectedCashflow` (deposit amount)
  - Treated as **gross ILS** in v1

- **Requested Date** (`CLICKUP.fields.requestedDate`)
  - Used by:
    - Financial → `expectedCashflow` (event date proxy)
    - Operations (Events) → `activeCustomers` (future events)

- **Email / Event Type / Participants**
  - Present in the contract (`CLICKUP.fields.email`, `eventType`, `participants`) but **not used in v1 metric computations**.

### Expenses list fields

- **Expense Date** (`CLICKUP.fields.expenseDate`)
  - Used by: Financial → `expectedExpenses` (month inclusion)

- **Expense Amount** (`CLICKUP.fields.expenseAmount`)
  - Used by: Financial → `expectedExpenses`
  - Treated as **gross ILS** in v1; net computed with VAT 18%

- **Expense Category / Supplier**
  - Present in the contract (`expenseCategory`, `expenseSupplier`) but **not used in v1 metric computations**.

## Status & source constants

Defined in `backend/config/dataContract.ts`:

- Lead statuses (Incoming Leads):
  - `New Lead`, `Closed Won`, `Closed Lost`, `Billing`, `Cancelled`
- Event statuses (Event Calendar):
  - `booked`, `staffing`, `logistics`, `ready`
- Sources:
  - `Landing Page`, `Word of Mouth`

Comparisons use a case-insensitive helper (`ciEquals`).

## Metric computations (per dashboard field)

All “month” checks are performed using `isWithinMonth(ms, range)`.

### Marketing

Computed in `backend/metrics/marketing.ts` from `NormalizedLead`.

- `marketing.totalLeads`
  - Source: ClickUp (Incoming Leads)
  - Formula: count of leads where `createdMs` is within the month

- `marketing.relevantLeads`
  - Source: ClickUp (Incoming Leads)
  - Formula:
    - `totalLeads` minus leads where:
      - `status == Closed Lost` (historically sometimes appears as `Closed Loss`) AND `lossReason == "Not Relevant"`

- `marketing.landingVisits`
  - Source: ClickUp (proxy)
  - Formula: count of leads created in month where `source == Landing Page`

- `marketing.landingSignups`
  - Source: ClickUp (proxy)
  - v1 rule: equals `landingVisits` (ClickUp treated as authoritative)

- `marketing.landingConversionPct`
  - Source: computed
  - v1 rule:
    - If `landingVisits == 0` → `null`
    - Else `(landingSignups / landingVisits) * 100` → always `100%` given `landingSignups == landingVisits`

### Financial

Financial metrics are computed from a mix of:

- `NormalizedLead` / `NormalizedExpense` (classic v1 metrics)
- **Event Calendar tasks + ClickBot comments** for the most important revenue metrics

The orchestration point is `backend/dashboard/computeDashboard.ts`, which may override some v1 values with Event Calendar–derived calculations.

VAT handling:

- Values marked as gross are converted to `{grossILS, netILS}` via `ensureNetGross` (VAT 18%).

#### `financial.monthlyRevenue` (current)

**Source:** ClickUp (Event Calendar + task comments)

This is computed from Event Calendar tasks using a two-part recognition model:

- **Deposit**: recognized in the month of the *deposit-paid* comment timestamp.
  - The amount comes from a Deposit field (name-matched, with a fallback to the existing `Paid Amount` field ID).
  - Trigger comment examples include Hebrew/English deposit-paid messages.

- **Balance**: recognized in the month of the *first* ClickBot status-change comment to DONE.
  - Uses the ClickBot comment: `Status has changed to : DONE`.
  - The amount comes from a Balance Due field (name-matched).
  - Uses the first DONE transition to avoid double counting if the task is reverted and later set to DONE again.

This logic lives in:

- Revenue aggregation: `backend/dashboard/computeDashboard.ts`
- Comment parsing: `backend/clickup/comments.ts`

#### Automation note: Closed Won moved to Event Calendar

In production, an automation can move a Closed Won task from **Incoming Leads** → **Event Calendar** and change its status to `booked`.
When that happens, the task will no longer appear in the Incoming Leads fetch, which would otherwise cause:

- `financial.monthlyRevenue` to miss the deal
- `sales.closures` to drop to 0

To keep metrics correct, the engine uses ClickUp task comments as a source of truth:

- It fetches task comments (`GET /task/{taskId}/comment`).
- It looks for a ClickBot comment like “Moved to Event Calendar … Closed Won”.
- The comment timestamp is treated as an **effective close date** for that deal.
- That deal is then injected into metrics via the optional `extraClosedWon`/`extraClosedWonCloseMs` inputs.

#### `financial.expectedCashflow` (current: Expected Revenue v2.0)

**Source:** ClickUp (Event Calendar + task comments)

This is an "Expected Revenue" view computed as:

- **A) Deposits in the month**
  - Deposit is attributed by the deposit-paid comment timestamp.

- **B) Scheduled balances for events in the month**
  - Uses `requestedDate` as the event month.
  - Excludes tasks whose current status is `Billing`.

- **C) Billing release balances in the month**
  - If the task transitions **Billing → Done** in the month, include the Balance Due.
  - The transition is detected by ordering ClickBot “Status has changed to : <X>” comments and finding the first observed Billing → Done sequence.

**Deduplication**
- If a task has any Billing → Done transition recorded, it is excluded from (B) to prevent counting both scheduled + released.

This logic lives in `backend/dashboard/computeDashboard.ts`, with status-history parsing helpers in `backend/clickup/comments.ts`.

- `financial.expectedExpenses`
  - Source: ClickUp (Expenses)
  - Included expenses:
    - `expenseDateMs` is within the month
  - Amount used:
    - `amountGrossILS` (Expense Amount) treated as gross ILS

### Sales

Computed in `backend/metrics/sales.ts` from `NormalizedLead` + `financial.monthlyRevenue`.

- `sales.salesCalls`
  - Source: ClickUp (Incoming Leads)
  - Formula:
    - leads created in month where `status != New Lead`

- `sales.closures`
  - Source: ClickUp (Incoming Leads)
  - Included leads:
    - `status == Closed Won`
    - close date is within month (close date = `date_closed` else `date_updated`)

- `sales.closeRatePct`
  - Source: computed
  - Formula:
    - If `salesCalls == 0` → `null`
    - Else `(closures / salesCalls) * 100`

- `sales.avgRevenuePerDeal`
  - Source: computed (derived from ClickUp revenue + ClickUp closures)
  - Formula:
    - If `closures == 0` → `null`
    - Else `monthlyRevenue / closures` (computed both gross and net)

### Operations

Computed in `backend/metrics/operations.ts` from `NormalizedEvent` + `NormalizedLead`.

- `operations.activeCustomers`
  - Source: ClickUp (Event Calendar)
  - Included events:
    - event status in `{booked, staffing, logistics, ready}`
    - AND `requestedDateMs >= computedAt` (future or today)

- `operations.cancellations`
  - Source: ClickUp (Event Calendar)
  - v1 rule:
    - count of events where `status == Cancelled` AND `updatedMs` is within the month

- `operations.referralsWordOfMouth`
  - Source: ClickUp (Incoming Leads)
  - Formula:
    - count of leads created in month where `source == Word of Mouth`

- `operations.returningCustomers`
  - Source: ClickUp (Incoming Leads)
  - Formula:
    1. Build a set of **historical Closed Won** lead phones (normalized) where close date is **before** the month
    2. Count unique normalized phones among leads created in month that exist in the historical Closed Won set

## Notes / edge cases

- If required fields are missing (e.g., no `requestedDateMs`), some cashflow items are skipped.
- Close date can fall back to `date_updated` when `date_closed` is missing.
- Several ClickUp contract fields exist but are not consumed by v1 computations; they are reserved for future metric expansions.

## Where to look in code

- ClickUp IDs + field IDs + statuses: `backend/config/dataContract.ts`
- ClickUp list fetch: `backend/clickup/fetchLists.ts`
- Task normalization: `backend/normalize/clickup.ts`
- Metric computations:
  - Financial: `backend/metrics/financial.ts`
  - Marketing: `backend/metrics/marketing.ts`
  - Sales: `backend/metrics/sales.ts`
  - Operations: `backend/metrics/operations.ts`
- Orchestration: `backend/dashboard/computeDashboard.ts`
