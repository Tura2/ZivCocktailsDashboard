# Roadmap — Ziv Cocktails Desktop Dashboard

**Type:** Feature-based roadmap

This file is a build sequence checklist. It complements (but does not replace):
- Product & invariants: [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md)
- Metric definitions: [METRICS_SPEC.md](METRICS_SPEC.md)
- ClickUp contract: [DATA_CONTRACT.md](DATA_CONTRACT.md)

---

## F0) Foundation & Guardrails (Non-negotiable)

Stage doc: [stages/F0_FOUNDATION.md](stages/F0_FOUNDATION.md)

**Goal:** Create a safe, stable base so nothing leaks secrets or logic.

Includes:
- Repo structure (Electron + React + Vite + TS + Tailwind)
- Firebase project setup
- Firestore collections (empty)
- Firebase Auth (invite by email)
- Environment & secrets handling
- Security rules (read-only client)

Done when:
- App launches
- Login works
- Firestore reads work
- No secrets in Electron

---

## F1) Cloud Data Engine (Core Logic)

Stage doc: [stages/F1_CLOUD_DATA_ENGINE.md](stages/F1_CLOUD_DATA_ENGINE.md)

**Goal:** Single authoritative computation engine.

Includes:
- ClickUp API client (read-only)
- Instagram API client (followers only)
- Metric computation module
- VAT handling (18%)
- Month range utilities
- Deterministic outputs

Done when:
- Can compute a dashboard object in isolation
- No Firestore writes yet (pure compute)

---

## F2) Snapshot Engine (Historical Truth)

Stage doc: [stages/F2_SNAPSHOT_ENGINE.md](stages/F2_SNAPSHOT_ENGINE.md)

**Goal:** Monthly history that never lies.

Includes:
- Snapshot generator
- Missing month detection
- Immutable snapshot write
- Diff vs previous snapshot
- Versioned output

Done when:
- Opening app after downtime backfills snapshots correctly

---

## F3) Firestore Persistence Layer

Stage doc: [stages/F3_FIRESTORE_PERSISTENCE.md](stages/F3_FIRESTORE_PERSISTENCE.md)

**Goal:** Fast dashboard loads.

Includes:
- Write dashboard/latest
- Write snapshots/{YYYY-MM}
- Job status tracking (jobs collection)
- Idempotent writes

Done when:
- Dashboard loads instantly from Firestore

---

## F4) Electron Auth + App Shell

**Goal:** Secure professional desktop experience.

Includes:
- Firebase Auth UI
- Protected routes
- Offline detection
- Error boundaries
- Single-window routing

Done when:
- App blocks unauthenticated access
- Offline state shown clearly

---

## F5) Dashboard UI (Main Value)

**Goal:** Business clarity at a glance.

Includes:
- KPI cards by category
- Charts (line / bar / pie)
- Last updated indicator
- Refresh button (trigger job)

Done when:
- Data reflects Firestore latest dashboard

---

## F6) History & Comparison UI

**Goal:** Monthly review tool.

Includes:
- Month selector
- Snapshot view
- % diff display
- Trend indicators

Done when:
- Can visually compare months

---

## F7) Export Engine

**Goal:** Take data outside the app.

Includes:
- CSV export
- Excel (.xlsx) export
- PDF export
- Export from snapshot

Done when:
- Exports match snapshot values exactly

---

## F8) Integrity Checks (Zapier Verification)

**Goal:** Trust the automation.

Includes:
- Verification jobs
- Cross-list checks
- Duplicate detection
- Log output

Done when:
- Script page shows pass/fail + logs

---

## F9) Polishing & Hardening

**Goal:** Production-ready.

Includes:
- Loading states
- Job locks
- Error recovery
- Windows EXE build