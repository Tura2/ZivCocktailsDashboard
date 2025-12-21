# Cloud Functions (F3)

Server-side persistence layer.

- Uses Firebase Admin SDK (server-only)
- Reuses the compiled backend engine (`dist/engine`) by copying it into `functions/engine` during build

## Build

From repo root:

- Build engine: `npm run f1:build`
- Install functions deps: `npm --prefix functions install`
- Build functions: `npm --prefix functions run build`

## Emulator (optional)

- `npm --prefix functions run serve`

## Env vars

- `CLICKUP_API_TOKEN` (required)
- `INSTAGRAM_ACCESS_TOKEN` (optional)
- `INSTAGRAM_IG_USER_ID` (optional)

The refresh endpoint requires Firebase Auth + allowlist (see `access/allowlist` with field `emails`).
