# Ziv Cocktails Dashboard (Desktop)

Electron + React (Vite) desktop dashboard for Ziv Cocktails.

## Docs

- Context / reading order: [docs/context/CONTEXT_INDEX.md](docs/context/CONTEXT_INDEX.md)

## Dev

- Install: `npm install`
- Run: `npm run dev`

## Rules (non-negotiable)

- No ClickUp/Instagram API secrets in Electron/renderer.
- Electron is read-only to business systems.
- Firestore stores computed results only.
- Access is restricted via `access/allowlist` (field `emails`) (see [firestore.rules](firestore.rules)).
