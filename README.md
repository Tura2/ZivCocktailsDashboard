# Ziv Cocktails Dashboard (Desktop)

Electron + React (Vite) desktop dashboard for Ziv Cocktails.

## Docs

- Context / reading order: [docs/CONTEXT_INDEX.md](docs/CONTEXT_INDEX.md)

## Recent work (Jan 2026)

- Added an in-app **Scripts** page to trigger operational sync jobs via Cloud Functions.
- Added Cloud Functions:
	- `POST /syncIncome` (iCount income/invoices → ClickUp)
	- `POST /syncExpenses` (iCount expenses → ClickUp)
- Frontend calls these endpoints using the signed-in user’s Firebase ID token.

Details: [docs/stages/F8_SCRIPTS_PAGE.md](docs/stages/F8_SCRIPTS_PAGE.md)

**Frontend env vars** (see `.env.example`):

- `VITE_SYNC_INCOME_URL`
- `VITE_SYNC_EXPENSES_URL`
- `VITE_DEV_EMAIL` (optional dev/emulator flow)

## Dev

- Install: `npm install`
- Run: `npm run dev`

## Rules (non-negotiable)

- No ClickUp/Instagram API secrets in Electron/renderer.
- Electron is read-only to business systems.
- Firestore stores computed results only.
- Access is restricted via `access/allowlist` (field `emails`) (see [firestore.rules](firestore.rules)).
