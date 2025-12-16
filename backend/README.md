# F1 — Cloud Data Engine (Computation Only)

This folder contains the **pure computation engine** for Ziv Cocktails metrics.

Constraints (F1):
- No Firestore
- No Electron/UI/Auth
- Read-only ClickUp fetch
- Optional Instagram followers fetch

## Commands

- Build: `npm run f1:build`
- Assert deterministic mock output (snapshot test):
	- PowerShell: `$env:F1_MONTH="2025-12"; npm run f1:assert:build`
	- Update snapshot intentionally: `$env:F1_MONTH="2025-12"; npm run f1:assert:update:build`
- Run with fixtures (deterministic):
	- PowerShell: `$env:F1_MONTH="2025-12"; npm run f1:run:mock:build`
	- Or direct: `npm run f1:build` then `node dist-backend/run/run-mock.js --month=2025-12`
- Run live (uses env vars):
	- PowerShell: `$env:F1_MONTH="2025-12"; npm run f1:run:live:build`

## F2 — Snapshots (mock)

- Generate snapshot records (mock):
	- PowerShell: `$env:F2_MONTHS="2025-10,2025-11,2025-12"; npm run f2:run:mock:build`
- Assert snapshot output matches committed expected JSON:
	- PowerShell: `$env:F2_MONTHS="2025-10,2025-11,2025-12"; npm run f2:assert:build`
- Update expected JSON intentionally:
	- PowerShell: `$env:F2_MONTHS="2025-10,2025-11,2025-12"; npm run f2:assert:update:build`

## Required env vars (live)

- `CLICKUP_API_TOKEN`
- `INSTAGRAM_ACCESS_TOKEN` (optional)
- `INSTAGRAM_IG_USER_ID` (optional)

Notes:
- Followers metrics are computed only for current + previous month. Older months return `null` with `meta.notes`.
- Month boundaries use UTC calendar month `[start, endExclusive)`.
