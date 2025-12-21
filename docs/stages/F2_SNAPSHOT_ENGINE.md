# F2 — Snapshot Engine (No Persistence Yet)

This file documents the **snapshot/backfill engine** that generates monthly snapshot records from F1 metrics.

**Hard constraints (F2):**

- No Firestore reads/writes
- No Electron/UI/Auth changes
- No scheduling/cron
- Deterministic output (mockable)

Related docs:

- Product & invariants: [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md)
- Metric definitions & formulas: [METRICS_SPEC.md](METRICS_SPEC.md)
- F1 compute engine: [F1_CLOUD_DATA_ENGINE.md](F1_CLOUD_DATA_ENGINE.md)

---

## Snapshot rule (critical)

- Snapshots represent the **full previous calendar month only**.
- Backfill generates missing months up to the target snapshot month.

---

## Types (locked)

- Snapshot types: [backend/snapshots/types.ts](../../backend/snapshots/types.ts)

`SnapshotRecord`:

- `month: "YYYY-MM"`
- `metrics: DashboardMetrics` (from F1)
- `diffFromPreviousPct: DiffObject`
- `computedAt: ISO string`
- `version: "v1"`

`DiffObject` mirrors metric leaves only (no `meta`):

- Counts/percents: `{ valuePct: number | null }`
- Money: `{ grossPct: number | null; netPct: number | null }`

---

## Month logic

- Month targeting + backfill list utilities: [backend/snapshots/monthLogic.ts](../../backend/snapshots/monthLogic.ts)

Rules:

- `getTargetSnapshotMonth(now)` returns previous month (`YYYY-MM`).
- `listMissingSnapshotMonths(lastSnapshotMonth, targetMonth)`:
  - If `lastSnapshotMonth` is `null` ⇒ returns `[targetMonth]`
  - If `lastSnapshotMonth >= targetMonth` ⇒ returns `[]`
  - Else ⇒ returns every month in `(lastSnapshotMonth + 1 ... targetMonth)` inclusive

---

## Diff rules

- Diff helpers: [backend/snapshots/diff.ts](../../backend/snapshots/diff.ts)

Definition:

- `deltaPct(current, previous) = ((current - previous) / previous) * 100`

Null rules:

- If `previous` is `null` or `0` ⇒ diff is `null`
- If `current` is `null` ⇒ diff is `null`

Rounding:

- Rounded to 2 decimals using `Math.round(x * 100) / 100` (applied at the end).

---

## Generator integration

- Generator: [backend/snapshots/generateSnapshotRecords.ts](../../backend/snapshots/generateSnapshotRecords.ts)

API:

- `generateSnapshotRecords({ months, computeDashboard }) => SnapshotRecord[]`

Behavior:

- Records are computed in chronological order.
- Each record’s diff is computed vs the previous month record.
- If there is no previous snapshot, diff leaves are `null`.

---

## Determinism & local validation

- Mock runner: [backend/run/run-snapshots-mock.ts](../../backend/run/run-snapshots-mock.ts)
- Assert runner: [backend/run/assert-snapshots-mock.ts](../../backend/run/assert-snapshots-mock.ts)
- Expected output snapshot: [backend/fixtures/expected-snapshots-2025-10_to_2025-12.json](../../backend/fixtures/expected-snapshots-2025-10_to_2025-12.json)

PowerShell examples:

- `$env:F2_MONTHS="2025-10,2025-11,2025-12"; npm run f2:assert:build`
- `$env:F2_MONTHS="2025-10,2025-11,2025-12"; npm run f2:assert:update:build` (intentional update)
