# F8 — Scripts Page + Cloud Functions Execution

## Goal

Provide an in-app **Scripts** page (Electron renderer) that can securely trigger operational sync jobs **in Firebase Cloud Functions**.

## Scope

- Two sync endpoints:
  - `POST /syncIncome` (Income/Invoices → ClickUp)
  - `POST /syncExpenses` (Expenses → ClickUp)
- Auth + allowlist identical to `/refresh`.
- Local persistence on the machine (last run timestamp + last status).

## Architecture

1) Electron (renderer) calls `POST /syncIncome` or `POST /syncExpenses` with a Firebase ID token.
2) Cloud Function:
   - Validates caller (Firebase ID token) and enforces allowlist (`access/allowlist`).
   - Runs the sync logic (iCount → ClickUp) in Node.js.
   - Returns JSON `{ status: "success", result: {...} }` or `{ error: {...} }`.
3) Renderer updates UI status and persists last-run metadata locally.

## Cloud Functions

### `POST /syncIncome` and `POST /syncExpenses` (region `me-west1`)

- Requires:
  - `Authorization: Bearer <Firebase ID token>`
  - Emulator/dev flow supports `x-dev-email` header (same as `/refresh`).
- Secrets:
  - `CLICKUP_API_TOKEN`
  - `ICOUNT_TOKEN`

## Local persistence (renderer)

Stored in `localStorage` under:

- Key: `ziv:scripts:lastRun`

Shape:

```json
{
  "income": { "lastRunAt": "<iso|null>", "lastStatus": "idle|success|failed" },
  "expenses": { "lastRunAt": "<iso|null>", "lastStatus": "idle|success|failed" }
}
```

## Running locally (emulators)

### 1) Frontend

- Ensure `.env` contains Firebase config and:
  - `VITE_SYNC_INCOME_URL`
  - `VITE_SYNC_EXPENSES_URL`

### 2) Functions emulator

- Start emulators:
  - `cd functions`
  - `npm run serve`

## Manual verification checklist

- In the app, open **Scripts** page.
- Click **Run** on Income:
  - Function call succeeds.
  - UI shows Success/Failed.
  - Local “Last ran locally” persists after app restart.
- Non-allowlisted:
  - Run attempt shows “No access (not allowlisted)”.
