# F0 — Foundation & Guardrails (Completed)

This file documents what is already implemented as the project baseline.

## Outcome

- App boots as a Windows desktop app (Electron) and loads the renderer (Vite + React).
- Login/Register UI works with Firebase Auth (email/password).
- Firestore reads are enforced by an email allowlist.
- Client is read-only (no Firestore writes from Electron/renderer).

## Tech stack

- Electron
- React
- Vite
- TypeScript
- Tailwind CSS
- Firebase: Auth + Firestore

## Repository layout

- Electron main process: [electron/main.ts](../../electron/main.ts)
- Electron preload: [electron/preload.ts](../../electron/preload.ts)
- Renderer entry: [src/main.tsx](../../src/main.tsx)
- Routing: [src/routes/AppRouter.tsx](../../src/routes/AppRouter.tsx)
- Auth guard: [src/routes/RequireAuth.tsx](../../src/routes/RequireAuth.tsx)
- Auth pages:
  - [src/pages/AuthLoginPage.tsx](../../src/pages/AuthLoginPage.tsx)
  - [src/pages/AuthRegisterPage.tsx](../../src/pages/AuthRegisterPage.tsx)
- Firebase client init (renderer only): [src/lib/firebase.ts](../../src/lib/firebase.ts)
- Firebase auth API helpers: [src/lib/api/auth.ts](../../src/lib/api/auth.ts)

## Environment & secrets handling

- Firebase config is provided via Vite env vars (renderer build-time):
  - See [.env.example](../../.env.example)
  - Put real values into a local `.env` (gitignored)
- Hard rule: no ClickUp/Instagram API secrets in Electron/renderer.

## Firestore & access control (locked)

### Region

- Firestore region: `me-west1` (Tel Aviv)

### Collections (initial placeholders)

- `access/allowlist`
- `dashboard/latest`
- `snapshots/init`
- `jobs/init`

### Allowlist model

- Access is restricted by email.
- Document: `access/allowlist`
- Field: `emails: array<string>`
- Rule check uses `request.auth.token.email`.

### Security rules (read-only client)

- Rules file: [firestore.rules](../../firestore.rules)
- Reads allowed only for allowlisted authenticated emails.
- Writes are denied for all clients.

## How to run

- Install: `npm install`
- Dev: `npm run dev`

Expected behavior:

- Unauthenticated users are routed to `/auth/login`.
- Authenticated allowlisted users can read Firestore.
- Authenticated non-allowlisted users get permission denied.

## Roadmap alignment

- F0 is done.
- No ClickUp/Instagram fetching.
- No metric computation engine.
- No Firestore writing jobs.

Next phase (do not start without confirmation): F1 Cloud Data Engine (pure compute).

