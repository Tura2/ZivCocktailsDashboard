# F4 — Electron Auth + App Shell

## 1) Stage Summary (what F4 adds)

F4 delivers a secure, professional **desktop app shell**:

- Firebase Auth UI (login/register) in the renderer
- Authentication-gated routes for all non-auth pages
- Reliable online/offline detection with a clear offline status and a friendly blocker screen
- Global error boundary with actionable fallback UI
- Single-window SPA routing (no extra windows)

---

## 2) Goals and Non-Goals

**Goals**

- Ensure the app blocks unauthenticated access to all protected pages.
- Provide a stable, professional navigation shell for authenticated users.
- Detect offline state and clearly communicate it to users.
- Prevent usage of network-required pages when offline.
- Catch unexpected UI errors and present a recovery path.

**Non-Goals (explicitly out of scope for F4)**

- Metrics computation (F1/F2) and snapshot logic (engine work)
- Refresh / persistence backend changes (F3)
- Any Firestore writes from the client
- Dashboard/History/Scripts business UI (these are placeholders until later stages)

---

## 3) UX Flows (Login → App, Logout, Offline, Error)

### Login → App

- User opens the app.
- If unauthenticated and they navigate to a protected page, they are redirected to `/auth/login`.
- Successful login redirects to `/dashboard`.

### Register → App

- User navigates to `/auth/register`.
- Successful registration redirects to `/dashboard`.

### Logout

- Authenticated user clicks **Sign out** in the app header.
- User is redirected to `/auth/login`.

### Offline

- When the app is offline:
  - A clear banner indicates offline state.
  - Dashboard/History/Scripts are blocked by a friendly offline screen with a **Retry** action.
- When the app returns online:
  - The offline banner disappears.
  - The blocked pages automatically become available again.

### Error

- If a render/runtime error occurs in the React UI:
  - A fallback screen appears.
  - The user can **Reload**, **Go to login**, or **Copy error id**.
  - Errors are logged to console (no external service required in F4).

---

## 4) Architecture / Key Files (list paths + responsibility)

**Auth & routing**

- [src/main.tsx](../../src/main.tsx)
  - Uses `HashRouter` for single-window routing.
- [src/routes/AppRouter.tsx](../../src/routes/AppRouter.tsx)
  - Defines routes:
    - `/auth/login`, `/auth/register`
    - `/dashboard`, `/history`, `/scripts`
  - Wraps all non-auth routes with auth + shell layout.
- [src/routes/RequireAuth.tsx](../../src/routes/RequireAuth.tsx)
  - Redirects unauthenticated users to `/auth/login`.

**Shell (offline + navigation)**

- [src/components/shell/AppShellLayout.tsx](../../src/components/shell/AppShellLayout.tsx)
  - App header/nav + Sign out.
  - Shows offline banner.
  - Blocks protected content with an offline screen when offline.
- [src/lib/useOnlineStatus.ts](../../src/lib/useOnlineStatus.ts)
  - Online/offline detection via `navigator.onLine` + events.
- [src/components/shell/OfflineBanner.tsx](../../src/components/shell/OfflineBanner.tsx)
  - Global offline status banner.
- [src/components/shell/OfflineScreen.tsx](../../src/components/shell/OfflineScreen.tsx)
  - Friendly offline blocker screen with retry.

**Error boundaries**

- [src/components/shell/ErrorBoundary.tsx](../../src/components/shell/ErrorBoundary.tsx)
  - Global error catcher with fallback UI and error id.
- [src/App.tsx](../../src/App.tsx)
  - Wraps the router in `ErrorBoundary`.

**Pages**

- [src/pages/AuthLoginPage.tsx](../../src/pages/AuthLoginPage.tsx)
- [src/pages/AuthRegisterPage.tsx](../../src/pages/AuthRegisterPage.tsx)
- [src/pages/DashboardPage.tsx](../../src/pages/DashboardPage.tsx)
- [src/pages/HistoryPage.tsx](../../src/pages/HistoryPage.tsx)
- [src/pages/ScriptsPage.tsx](../../src/pages/ScriptsPage.tsx)

---

## 5) Security Notes (auth gating, no secrets in renderer)

- Auth uses Firebase client SDK initialized from `VITE_*` env vars only.
- No ClickUp/Instagram secrets are stored in the renderer.
- Firestore rules deny all client writes; F4 does not introduce any client write paths.
- All non-auth routes are guarded by `RequireAuth`.

---

## 6) Offline Behavior (how detected, what UI shows, what is blocked)

**Detection**

- Uses `navigator.onLine` to seed state.
- Subscribes to `online` / `offline` window events to update state.

**UI**

- When offline:
  - The app header shows an offline banner.
  - The main content area is replaced by an offline screen.

**Blocked behavior**

- `/dashboard`, `/history`, `/scripts` are blocked while offline.
- Auth routes are still reachable, but login/register actions may fail while offline.

---

## 7) Error Boundaries (what is caught, fallback UI, logging)

**What is caught**

- Render/runtime errors thrown by React components under the boundary.

**Fallback UI**

- Shows a professional error screen with:
  - Reload
  - Go to login
  - Copy error id
  - Collapsible details section

**Logging**

- Logs to `console.error` only (no external logging service in F4).

---

## 8) Acceptance Criteria Checklist (map to “Done when” + include manual test steps)

### “App blocks unauthenticated access”

- [ ] Open app fresh (signed out).
- [ ] Navigate directly to `#/dashboard`.
- [ ] Confirm redirect to `#/auth/login`.
- [ ] Repeat for `#/history` and `#/scripts`.

### “Offline state shown clearly”

- [ ] Sign in.
- [ ] Toggle offline in devtools (or disable network).
- [ ] Confirm an offline banner is visible.
- [ ] Confirm protected pages show the offline blocker screen.
- [ ] Re-enable network.
- [ ] Confirm banner disappears and protected content is visible again.

### “Error boundary catches a forced render error”

- [ ] Temporarily add `throw new Error('F4 test crash')` to a protected page component render.
- [ ] Confirm the fallback screen appears.
- [ ] Click **Copy error id** and confirm it copies (or prompts).
- [ ] Click **Go to login** and confirm navigation to `#/auth/login`.
- [ ] Remove the test crash.

---

## 9) Follow-ups (only if truly out of scope for F4)

- Implement actual Dashboard/History/Scripts data UI (F5/F6/F8).
- Add UX improvements for offline login/register (optional) without expanding scope.
- Add structured error reporting service (future hardening stage).
