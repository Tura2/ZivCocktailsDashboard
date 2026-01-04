# Frontend UI Overview (Ziv Cocktails Dashboard)

This document describes the current frontend UI: what screens exist, how navigation works, and what a user sees/does in each screen.

Tech stack (UI)

- React + Vite
- Tailwind CSS
- React Router using `HashRouter`
- Firebase client SDK (Auth + Firestore reads) when configured

---

## Visual style (colors + layout)

The UI is mostly Tailwind utility styling, with two distinct “looks”:

- Auth pages use a custom olive/cream palette and a more “marketing” layout.
- The main app (Dashboard/History/Scripts) uses a neutral gray/slate base (white surfaces, subtle borders), plus semantic category accents.

### Semantic category accents (single source of truth)

Financial/Marketing/Sales/Operations use consistent accent colors everywhere they appear (section headers, KPI tiles, charts):

- Financial: emerald
- Marketing: fuchsia
- Sales: indigo
- Operations: amber

Implementation: [src/ui/categoryTheme.ts](../src/ui/categoryTheme.ts).

### Main app (Dashboard / History / Scripts)

- Page background: light gray (`bg-gray-50`) with a sticky, blurred header (`bg-white/80` + `backdrop-blur`).
- Layout: wider centered content (`max-w-7xl`) with denser padding (`px-6 lg:px-8`).
- Text hierarchy:
  - Headings typically use `text-slate-900` and `font-semibold`.
  - Secondary/help text uses `text-slate-600`.
  - Muted meta text uses `text-slate-500`.
- Cards:
  - Many pages use the shared `Card` UI primitive (white surface + subtle border + soft shadow).
  - Some pages also render simple “card-like” blocks using Tailwind directly (rounded corners, `bg-white`, and subtle borders).
- Controls: consistent rounded corners (`rounded-lg`) with subtle borders; hover states add light gray backgrounds.
- Density: Dashboard includes a UI-only toggle (Comfortable vs Compact) that changes spacing.

### Auth pages (Login / Register)

Auth styling is defined by a mix of CSS variables (in [src/styles/globals.css](../src/styles/globals.css)) and hard-coded palette values in auth components:

- Background: soft slate-like background (`--auth-bg: #f8fafc`) with a large blurred gradient “halo” behind the auth card.
- Surface: white card (`--auth-surface: #ffffff`) with a large rounded rectangle and a stronger drop shadow.
- Brand/accent: olive green used for primary CTA + links:
  - Primary green: `#3a5b22`
  - Hover: `#31501d`
- Form fields: white input background, subtle border (`--auth-stroke`), and green focus ring.
- Status colors:
  - Errors use a warm red (`#d94841`).
  - Success messages reuse the olive green.
- Decorative elements:
  - Right-side image panel on large screens with a dark overlay gradient.
  - Eyebrow pill uses pale green background with olive text.

---

## App entry + routing

- The app mounts in `HashRouter` (URLs look like `#/dashboard`, `#/auth/login`). See [src/main.tsx](../src/main.tsx).
- Top-level routing lives in [src/routes/AppRouter.tsx](../src/routes/AppRouter.tsx):
  - Public routes:
    - `#/auth/login`
    - `#/auth/register`
  - Protected routes (require authentication):
    - `#/dashboard`
    - `#/history`
    - `#/scripts`
  - Unknown routes redirect to `#/auth/login`.

The router is wrapped by an error boundary in [src/App.tsx](../src/App.tsx), so render-time errors show a dedicated error UI instead of a blank screen.

---

## Global shell behavior

Protected pages render inside a shared “app shell” layout. See [src/components/shell/AppShellLayout.tsx](../src/components/shell/AppShellLayout.tsx).

What the shell looks like

- A top header bar with:
  - App title (“Ziv Cocktails”)
  - Navigation links: Dashboard / History / Scripts
  - A “Sign out” button

Shell polish

- Header is sticky and uses a subtle blur to feel like an “app shell”.
- Active route is shown as a filled pill (dark background + white text).

Connectivity behavior

- When the browser is offline:
  - An offline banner appears (see [src/components/shell/OfflineBanner.tsx](../src/components/shell/OfflineBanner.tsx)).
  - Protected pages are blocked by a full “Offline” screen instead of rendering their content (see [src/components/shell/OfflineScreen.tsx](../src/components/shell/OfflineScreen.tsx)).

Error handling

- If a React error bubbles to the root error boundary, the user sees an error screen with:
  - A generated error id (copyable)
  - Buttons to reload or go to login
  - Optional stack/details section

See [src/components/shell/ErrorBoundary.tsx](../src/components/shell/ErrorBoundary.tsx).

---

## Auth screens

Routes

- Login: `#/auth/login` (see [src/pages/AuthLoginPage.tsx](../src/pages/AuthLoginPage.tsx))
- Register: `#/auth/register` (see [src/pages/AuthRegisterPage.tsx](../src/pages/AuthRegisterPage.tsx))

Layout

- Both pages use a shared auth layout (see [src/components/auth/AuthLayout.tsx](../src/components/auth/AuthLayout.tsx)):
  - Responsive design: on larger screens it presents a two-column layout (marketing/visual panel + form panel).

Login

- Email + password form
- Inline validation + error/status feedback
- Link to the register page

See [src/components/auth/LoginForm.tsx](../src/components/auth/LoginForm.tsx).

Register

- Name, email, password + required agreement checkbox
- Inline validation + error/status feedback
- On success, it navigates into the authenticated app.

See [src/components/auth/RegisterForm.tsx](../src/components/auth/RegisterForm.tsx).

---

## Dashboard page

Route

- `#/dashboard` (protected)

What it shows

- Top toolbar:
  - Title
  - Last updated + current month
  - Refresh button (primary)
  - Density toggle (Comfortable/Compact)
- A KPI tiles row (headline KPIs), with semantic category accents.
- Four category sections (Financial/Marketing/Sales/Operations) rendered as “section cards”:
  - KPI grid on the left
  - Small chart/summary on the right

State handling

- Loading state while fetching (skeleton tiles/sections)
- Error state if fetch fails
- “No data” messaging if there is no latest dashboard data

Implementation reference: [src/pages/DashboardPage.tsx](../src/pages/DashboardPage.tsx).

---

## History page

Route

- `#/history` (protected)

Purpose

- Browse historic monthly snapshot documents from Firestore under `snapshots/{YYYY-MM}`.
- Show simple trends derived from those snapshots.
- Export a chosen month’s snapshot to CSV/XLSX/PDF.

Month selection UI

- A sticky filter bar with two dropdowns:
  - Start month
  - End month
- Leaving both blank defaults the view to the current year (e.g. 2026).
- Month dropdown options default to the current year; you can optionally include the previous year (e.g. 2025).
- A Reset button clears the selection.

Trends

- A 2-up trends grid:
  - Financial revenue line chart (gross vs net)
  - Marketing total leads bar chart
- Trend values are derived from the snapshot docs currently being viewed.
- Null values are handled as “missing” and are skipped/treated as gaps.

Per-month cards

- Each month is rendered as an accordion card:
  - Collapsed view shows month + computed timestamp + 4 headline KPIs.
  - Expanded view shows:
    - Export controls
    - Full category KPI breakdown (Financial/Marketing/Sales/Operations)

Gaps are allowed

- If the month is in the selected range but there is no Firestore document, the UI renders a “Missing snapshot” card explaining no doc exists at `snapshots/{month}`.

Exports

- Exports are available when a month card is expanded:
  - CSV / XLSX / PDF
- Export behavior:
  - Reads `snapshots/{month}` directly from Firestore before exporting (export is based on the stored snapshot data; it does not recompute).
  - Generates a file name like `ziv-cocktails_snapshot_{YYYY-MM}.{ext}`.
  - Shows a status card while exporting, and success/error messages after.

Implementation reference: [src/pages/HistoryPage.tsx](../src/pages/HistoryPage.tsx).

---

## Scripts page

Route

- `#/scripts` (protected)

Current behavior

- Placeholder UI indicating operational scripts UI will be implemented later.

Implementation reference: [src/pages/ScriptsPage.tsx](../src/pages/ScriptsPage.tsx).

---

## Firebase/Firestore configuration note (UI)

Some pages require Firebase to be configured to read Firestore.

- If Firebase env vars are not configured, the History page displays a “Firebase is not configured” message instead of attempting reads.
- Dashboard/History are designed around Firestore documents (latest dashboard + monthly `snapshots`).

If you want, I can add a short “How to run locally” section here (what `VITE_*` env vars are expected and where they’re used), but I didn’t include it by default to keep this doc focused on how the UI looks/behaves.
