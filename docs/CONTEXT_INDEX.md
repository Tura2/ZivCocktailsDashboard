# Context Index — Ziv Cocktails Dashboard

This repository uses a small set of Markdown docs as the “source of truth” for requirements and computations.

## Recommended reading order

1. **Product & invariants** → [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md)

- What the app is (read-only BI dashboard)
- Non-negotiable principles
- Pages/behavior (Dashboard, History, Scripts)
- Snapshot invariants and offline behavior

1. **ClickUp contract (IDs + fields)** → [DATA_CONTRACT.md](DATA_CONTRACT.md)

- ClickUp list IDs
- Custom field IDs and types
- Data guarantees/assumptions

1. **ClickUp computations (how fields are used)** → [CLICKUP_COMPUTATION.md](CLICKUP_COMPUTATION.md)

- How raw ClickUp tasks are normalized
- How each ClickUp field contributes to each dashboard metric

1. **Metric definitions & formulas** → [METRICS_SPEC.md](METRICS_SPEC.md)

- Metric names, sources, filters, formulas
- Global conventions (month ranges, VAT)
- Snapshot calculation rules

1. **Build sequence** → [ROADMAP.md](ROADMAP.md)

- Feature phases (F0–F9)
- “Done when” acceptance checkpoints

## Recent changes

- Quick log of recent doc + engine changes: [RECENT_CHANGES.md](RECENT_CHANGES.md)

## Current baseline

- Foundation status (what’s already implemented): [stages/F0_FOUNDATION.md](stages/F0_FOUNDATION.md)
- F1 compute engine (backend-only): [stages/F1_CLOUD_DATA_ENGINE.md](stages/F1_CLOUD_DATA_ENGINE.md)
- F2 snapshot engine (engine-only; persistence happens in F3): [stages/F2_SNAPSHOT_ENGINE.md](stages/F2_SNAPSHOT_ENGINE.md)
- F3 persistence layer (Firestore writes via Functions): [stages/F3_FIRESTORE_PERSISTENCE.md](stages/F3_FIRESTORE_PERSISTENCE.md)

## Ground rules (quick)

- The desktop app is UI-only; compute happens in cloud jobs.
- Electron client must never hold API secrets.
- Firestore stores computed outputs only (latest + snapshots), not raw ClickUp/Instagram records.
- Firestore reads require allowlisted email (`access/allowlist` field `emails`).
- Snapshots are immutable and represent the full previous calendar month only.
