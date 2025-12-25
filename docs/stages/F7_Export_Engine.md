# F7 — Export Engine

## 1) Stage Summary

F7 adds a **snapshot export engine** that lets a user export a single Firestore snapshot document (`snapshots/{YYYY-MM}`) into:

- CSV
- Excel (`.xlsx`)
- PDF

Exports are generated in the renderer from the **fetched snapshot object** (read-only), with deterministic ordering and a validation step to support “matches snapshot values exactly”.

---

## 2) Goals and Non-Goals

**Goals**

- Export data outside the app from a **single snapshot** document.
- Provide three export formats: CSV, XLSX, PDF.
- Ensure exports match the snapshot values **exactly** (no recomputation; formatting is representation-only).
- Keep the export engine deterministic and testable (pure functions).
- Provide a minimal UI entry point that clearly indicates the exported month.

**Non-Goals (explicitly out of scope for F7)**

- Export from `dashboard/latest` (unless the user selects a month that maps to a snapshot, and that snapshot is exported).
- Any backend changes (no new functions, no scheduling).
- Any Firestore writes from the client.
- Any metric recomputation, derived metrics, or client-side diffs.

---

## 3) Export Sources & Data Contract (exact fields used from SnapshotRecord)

**Source of truth**

- Firestore document: `snapshots/{YYYY-MM}`

**SnapshotRecord fields used**

- `month` (string `YYYY-MM`)
- `computedAt` (ISO string)
- `metrics` (entire `DashboardMetrics` object; only leaf numeric fields are exported)
- `diffFromPreviousPct` (entire DiffObject; only leaf numeric fields are exported)

No other documents are queried.

---

## 4) Export Formats (CSV / XLSX / PDF) with layout rules

### CSV

- One header row + one row per exported metric leaf.
- Columns:
  - `month`
  - `computedAt`
  - `category` (Financial / Marketing / Sales / Operations)
  - `metricKey` (stable identifier)
  - `metricLabel` (human label)
  - `valueKind` (count / percent / currency_gross / currency_net)
  - `value` (raw numeric string; empty if null)
  - `diffKind` (valuePct / grossPct / netPct)
  - `diffPct` (raw numeric string; empty if null)
- Ordering: fixed and stable, defined by the export row descriptor list.

### XLSX

- Workbook contains:
  - Sheet 1: `Snapshot` (human-readable summary)
  - Sheet 2: `Raw` (one row per metric leaf)
- `Raw` sheet columns match the CSV columns.
- Numeric cells are numeric where possible (`value` and `diffPct` are written as numbers or empty).
- Ordering is stable.

### PDF

- Report title: `Ziv Cocktails — Monthly Snapshot`
- Includes:
  - Month and computedAt
  - Tables per category (Metric / Value / MoM diff)
- Values are representation-only (no rounding that changes numeric meaning; null shows as `—`).

---

## 5) File Naming Convention (include month)

- `ziv-cocktails_snapshot_YYYY-MM.csv`
- `ziv-cocktails_snapshot_YYYY-MM.xlsx`
- `ziv-cocktails_snapshot_YYYY-MM.pdf`

---

## 6) Rounding & Formatting Rules (currency, %, nulls)

**Hard rule:** Do not change snapshot values. Only change representation.

**Numeric formatting rule (all exports):** every numeric value is written/rendered with **2 digits after the decimal point**.
Example: `23456.34325252` is exported as `23456.34`.

- Currency:
  - CSV/XLSX/PDF use 2-decimal formatting.
  - PDF includes a `₪` prefix.
- Percent:
  - CSV/XLSX/PDF use 2-decimal formatting.
  - PDF includes a `%` suffix.
- Null:
  - CSV: empty cell
  - XLSX: empty cell
  - PDF: `—`
- Zero:
  - Preserved as `0` (not treated as empty)

---

## 7) Validation / How we ensure “matches snapshot exactly”

Deterministic validations are performed during export:

- CSV: after generating the CSV, it is parsed and compared row-by-row back to the snapshot-derived export rows (including numeric cells).
- XLSX: after generating the workbook, it is read back and the `Raw` sheet is compared to the expected table.

If validation fails, export throws with a clear error.

---

## 8) Acceptance Criteria Checklist (maps to Done when)

- [ ] From the app, user can export a selected snapshot month to CSV
- [ ] From the app, user can export a selected snapshot month to XLSX
- [ ] From the app, user can export a selected snapshot month to PDF
- [ ] Export source of truth is `snapshots/{YYYY-MM}` (snapshot doc is fetched before export)
- [ ] No recomputation / no derived metrics
- [ ] Exports match snapshot values exactly (validated)
- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] This doc exists at `docs/stages/F7_Export_Engine.md`

---

## 9) Follow-ups

- Add a range export (zip multiple months) only if a later stage requires it.
- Improve PDF typography/layout (column widths, long label wrapping, page breaks).
- Add an explicit user-facing “Export preview” panel if desired.
