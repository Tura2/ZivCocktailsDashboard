# Missions Plan (Dashboard Finalization)

Date: 2025-12-28

This plan covers 2 missions:
1) **Mission 1** — Create deterministic **mock Firestore snapshot data** to validate that the dashboard renders and computes every field correctly, with a clear **expected result** to compare against actual UI output.
2) **Mission 2** — Analyze **income/expenses source data** (iCount + ClickUp) to identify gaps in historical snapshots and propose/implement backfills or derived fields.

Constraints / rules (explicit)
- Do not modify existing dashboard source files unless explicitly approved. For now: **read-only** on existing files.
- Allowed: add new **scripts/docs** files (e.g., this plan, mock-data generator) that do not change runtime behavior unless the user approves.
- If any required details about Firestore schema, ClickUp field IDs, or environment are missing/unclear: **stop and ask immediately**.
- Prefer **Firestore emulator** for mock seeding to avoid touching production.

---

## Mission 1 — ClickUp fixtures (create mock tasks) + expected results

### Goal
Create a **controlled set of real ClickUp tasks** (leads + events + expenses) in your ClickUp space/lists, then run the normal dashboard refresh/compute so we can verify:
- the computation logic matches the spec (including edge cases like Cancelled events)
- the resulting Firestore snapshot metrics match a written **expected results** sheet

This specifically addresses cases like: “operations.cancellations counts Event Calendar tasks with status Cancelled updated in-month” by creating a mock Cancelled event and validating the count.

### What “mock data” means (scope)
Primary approach: **ClickUp-driven fixtures**
- We create tasks in the *real ClickUp lists the engine reads*:
   - Incoming Leads list: `CLICKUP.lists.incomingLeads = 901214362127`
   - Event Calendar list: `CLICKUP.lists.eventCalendar = 901214362128`
   - Expenses list: `CLICKUP.lists.expenses = 901214544874`
- We set the exact custom fields the computations consume (IDs are locked in `backend/config/dataContract.ts`).
- Then we run the normal refresh flow so the engine fetches ClickUp, computes metrics, and writes Firestore snapshots.

Optional fallback (UI-only): **snapshot-level seeding**
- If you want to validate UI rendering without touching ClickUp, we can seed `snapshots/{YYYY-MM}` in the Firestore emulator.
- This is optional; the main validation for correctness will be ClickUp fixtures.

### Step-by-step execution
1) **Lock down the exact computation inputs (read-only)**
   - List IDs / field IDs / statuses: `backend/config/dataContract.ts`
   - Normalization rules: `backend/normalize/clickup.ts`
   - Metric logic:
     - Financial: `backend/metrics/financial.ts`
     - Marketing: `backend/metrics/marketing.ts`
     - Sales: `backend/metrics/sales.ts`
     - Operations: `backend/metrics/operations.ts`

2) **Choose the validation month (important limitation)**
   - Many metrics depend on ClickUp system timestamps (`date_created`, `date_updated`, `date_closed`). Those cannot be arbitrarily backdated via API.
   - Therefore the cleanest deterministic validation is for the **current month** (the month in which we create/update/close the fixture tasks).
   - We will run refresh with `targetMonth = current month (YYYY-MM)`.

3) **Define a fixture matrix (minimal but covers the logic)**
   - All fixture task names start with a prefix like `FIXTURE_DASHBOARD_TEST__` so we can find/clean them.
   - Incoming Leads (covers Marketing + Sales + Financial):
     - Lead A: Source=Landing Page, Status=New Lead (counts totalLeads only)
     - Lead B: Source=Landing Page, Status=Closed Loss, Loss Reason="Not Relevant" (reduces relevantLeads)
     - Lead C: Source=Word of Mouth, Status=Some non-New status (counts referrals + salesCalls)
     - Lead D: Status=Closed Won, Budget set (counts monthlyRevenue + closures)
     - Lead E: Status!=Billing, Requested Date in this month, Paid Amount set, and we update/close it this month to trigger expectedCashflow rule (1)
     - Lead F: Status=Billing (verifies expectedCashflow exclusion)
   - Event Calendar (covers Operations):
     - Event 1: Status=booked, Requested Date >= today (counts activeCustomers)
     - Event 2: Status=Cancelled (set/updated this month) (counts cancellations)
   - Expenses list (covers expectedExpenses):
     - Expense 1: Expense Date in month, Amount set (counts expectedExpenses)

4) **Write down expected results (golden output)**
   - Create a Markdown table mapping each metric -> expected value.
   - For money fields we’ll compute expected gross/net using VAT 18% (engine behavior).
   - Note: Followers metrics depend on Instagram availability; we’ll record the expected notes/value based on whether Instagram is configured.

5) **Implement a ClickUp fixture creator script (new file only)**
   - New file: `tools/clickup_seed_fixtures.py`
   - Responsibilities:
     - create tasks in the three list IDs
     - set custom fields by ID (phone/source/lossReason/budget/requestedDate/paidAmount, expenseDate/expenseAmount)
     - set statuses (including Cancelled on Event Calendar)
     - print and save created task IDs to `tools/fixture_ids.json` for cleanup
   - Include a cleanup mode: delete all tasks listed in `fixture_ids.json`.

6) **Run refresh and compare**
   - Trigger the normal refresh (Cloud Function / local runner depending on your setup).
   - Fetch the resulting snapshot doc for the target month and compare to the expected table.

7) **(Optional) UI-only snapshot seeding**
   - If needed to validate rendering without waiting on ClickUp/refresh, seed snapshots in emulator.

### Acceptance criteria
- After refresh, the snapshot metrics for the chosen month match the expected results table.
- Specifically validated edge cases:
   - `operations.cancellations` increments when we create/update a Cancelled Event Calendar task in-month.
   - `financial.expectedCashflow` follows rules (1)/(3) depending on event month and close/update timing.
   - `marketing.relevantLeads` excludes Closed Loss + "Not Relevant".

UI rendering checks are still valuable, but correctness is proven by the computed snapshot matching the expected table.

### Open questions to confirm before creating ClickUp fixtures (must answer)
- Do you want these fixtures created in the **production ClickUp lists** above, or do you have a dedicated **test space/lists**?
   - If production lists: confirm it’s OK to create and later delete tasks with prefix `FIXTURE_DASHBOARD_TEST__`.
- How do you trigger refresh today?
   - via the dashboard UI (Firebase Auth + HTTP function), or
   - locally (functions emulator / direct script).
- Are Instagram credentials configured? If not, followers metrics will be `null` with notes.

---

## Mission 2 — Fill snapshot gaps using income/expense sources

### Goal
Identify missing or unreliable snapshot fields (historical months), and backfill them using:
- iCount exports (income + expenses)
- ClickUp expenses list (if available historically)

### Step-by-step execution
1) **Identify which snapshot fields are missing**
   - Provide 1–2 example snapshot docs with missing fields, or a list of missing metric paths.

2) **Map available sources to snapshot fields**
   - From iCount:
     - monthly income totals (gross/net using VAT fields)
     - monthly expense totals (gross/net)
   - From ClickUp (Expenses list): expectedExpenses proxy

3) **Compute monthly aggregates and propose backfill rules**
   - Standardize VAT rate handling (the engine uses 18% but iCount examples show 17% in older docs).
   - Decide “source of truth” per month/field.

4) **Backfill options (choose one)
   - A) Offline backfill script that writes missing fields into a new collection (non-invasive)
   - B) Offline backfill script that writes corrected snapshot docs (emulator first; production only with explicit approval)
   - C) Update compute engine to incorporate iCount for older months (requires code changes + deployment)

### Acceptance criteria
- For months with gaps, we can generate a consistent financial section (at least revenue/expenses) with documented provenance.
- Backfill is reproducible (scripted) and does not require manual edits.

---

## Next step
You review this plan. After approval, we start Mission 1 by reading the schema files listed above and generating a concrete mock dataset + expected-results table.
