# F1 — Cloud Data Engine (Computation Only)

This file documents the **backend-only computation engine** that turns ClickUp (+ optional Instagram followers) data into a deterministic `DashboardMetrics` object.

**Hard constraints (F1):**

- No Firestore reads/writes
- No Electron/UI/Auth changes
- ClickUp is read-only (never writes)
- Secrets live in server env only (never in Electron)

Related docs:

- Product & invariants: [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md)
- Metric definitions & formulas: [METRICS_SPEC.md](METRICS_SPEC.md)
- ClickUp IDs & field mappings: [DATA_CONTRACT.md](DATA_CONTRACT.md)

---

## Outcome

- Deterministically computes a `DashboardMetrics` object for a given month (`YYYY-MM`).
- ClickUp is the source of truth for business data.
- Instagram is used only for follower metrics.
- VAT is hardcoded to 18%.

---

## Repository layout (backend)

- Entry point (unified output): [backend/dashboard/computeDashboard.ts](../../backend/dashboard/computeDashboard.ts)
- Output schema: [backend/dashboard/types.ts](../../backend/dashboard/types.ts)

### ClickUp

- Read-only client interface: [backend/clickup/ClickUpClient.ts](../../backend/clickup/ClickUpClient.ts)
- HTTP implementation (pagination + rate limit backoff): [backend/clickup/ClickUpHttpClient.ts](../../backend/clickup/ClickUpHttpClient.ts)
- List helpers (Incoming Leads / Event Calendar / Expenses): [backend/clickup/fetchLists.ts](../../backend/clickup/fetchLists.ts)
- Locked IDs: [backend/config/dataContract.ts](../../backend/config/dataContract.ts)

### Normalization

- ClickUp task normalization (custom field extraction): [backend/normalize/clickup.ts](../../backend/normalize/clickup.ts)
- Phone normalization (returning customers): [backend/normalize/phone.ts](../../backend/normalize/phone.ts)

### Metrics

- Financial: [backend/metrics/financial.ts](../../backend/metrics/financial.ts)
- Marketing: [backend/metrics/marketing.ts](../../backend/metrics/marketing.ts)
- Sales: [backend/metrics/sales.ts](../../backend/metrics/sales.ts)
- Operations: [backend/metrics/operations.ts](../../backend/metrics/operations.ts)

### VAT

- VAT rate + net/gross helpers: [backend/vat/vat.ts](../../backend/vat/vat.ts)

### Instagram (followers only)

- Client interface: [backend/instagram/InstagramClient.ts](../../backend/instagram/InstagramClient.ts)
- Graph API implementation: [backend/instagram/InstagramGraphClient.ts](../../backend/instagram/InstagramGraphClient.ts)

---

## Dashboard output schema (locked)

The engine returns `DashboardMetrics` with:

- `version: "v1"`
- `month: "YYYY-MM"`
- `computedAt: ISO string`
- grouped metric objects: `financial`, `marketing`, `sales`, `operations`

Each metric leaf has a `meta` object (`source` + optional `notes`).

---

## Determinism & local validation

### Mock run (fixtures)

- Mock dependencies: [backend/run/mockDeps.ts](../../backend/run/mockDeps.ts)
- Mock runner: [backend/run/run-mock.ts](../../backend/run/run-mock.ts)
- Expected output snapshot: [backend/fixtures/expected-dashboard-2025-12.json](../../backend/fixtures/expected-dashboard-2025-12.json)
- Assert runner: [backend/run/assert-mock-output.ts](../../backend/run/assert-mock-output.ts)

PowerShell examples:

- `$env:F1_MONTH="2025-12"; npm run f1:assert:build`
- `$env:F1_MONTH="2025-12"; npm run f1:assert:update:build` (intentional update)

### Live run (read-only)

- Runner: [backend/run/run-live.ts](../../backend/run/run-live.ts)

Env vars:

- `CLICKUP_API_TOKEN`
- `INSTAGRAM_ACCESS_TOKEN` (optional)
- `INSTAGRAM_IG_USER_ID` (optional)

Notes:

- Followers metrics are supported only for **current + previous month**. Older months return `null` with `meta.notes`.
