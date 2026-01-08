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
    - `#/salaries`
  - Unknown routes redirect to `#/auth/login`.

The router is wrapped by an error boundary in [src/App.tsx](../src/App.tsx), so render-time errors show a dedicated error UI instead of a blank screen.

---

## Global shell behavior

Protected pages render inside a shared “app shell” layout. See [src/components/shell/AppShellLayout.tsx](../src/components/shell/AppShellLayout.tsx).

What the shell looks like

- A top header bar with:
  - App title (“Ziv Cocktails”)
  - Navigation links: Dashboard / History / Scripts / Salaries
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

Refresh behavior

- On the first authenticated load (once per app session), the app triggers a best-effort refresh in the background.
  - This does not show the logo overlay.
  - The Dashboard Refresh button reflects the real job state by tracking `jobs/{jobId}`.
- Manual refresh (Dashboard Refresh button) shows the logo overlay immediately.
  - If the backend reports `already_running`, the overlay is dismissed and the button switches to **Running…** (disabled) by tracking the existing job.

KPI calculation tooltips

- KPI cards can show a “Calculation breakdown” hover tooltip when breakdown data exists in Firestore.
- Data source: `snapshots/{month}/metricBreakdowns/{metricKey}` (lazy-loaded on hover).
- Tooltips are used on both Dashboard and History KPI grids.

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

## Salaries page

Route

- `#/salaries` (protected)

Data flow

- Reads payroll rows via HTTP Cloud Function:
  - `VITE_SALARIES_URL`
- Saves edits via HTTP Cloud Function:
  - `VITE_SALARY_SAVE_URL`
- Accepts previous-month accrual via HTTP Cloud Function:
  - `VITE_SALARY_ACCEPT_URL`
- Records a payment (subtract from balance) via HTTP Cloud Function:
  - `VITE_SALARY_PAY_URL`
- Reads payment transaction history via HTTP Cloud Function:
  - `VITE_SALARY_HISTORY_URL`

Flow / story

The Salaries page is designed as a “compute + review + persist” workflow:

1) Compute (read-only)

- When the page loads (and whenever the month selector changes), the UI calls `fetchSalaries(month)`.
- The backend (`salaries` HTTP function) pulls:
  - employees from ClickUp Staff Directory
  - done events for the selected month from ClickUp Event Calendar
  - per-employee defaults/snapshots from Firestore
- The response is a list of per-employee rows with:
  - `eventCount` and `events[]` (for the selected month)
  - payroll inputs (`baseRate`, `videosCount`, `bonus`)
  - computed totals (`eventsTotal`, `videosTotal`, `total`)
  - balance/status fields (`currentBalance`, `paymentStatus`, and processed markers when relevant)

2) Review / Edit (client-only state)

- Each employee renders as an accordion card.
- There are 2 views (Formula/Table) that show the same underlying data.
- Clicking “Edit” switches the row into local draft mode (inputs are stored only in React state).

3) Save (persist snapshot for the selected month)

- Clicking “Save” calls `salarySave` with the row’s `baseRate`, `videoRate`, `videosCount` (read-only), `bonus`, plus `events` for audit.
- If nothing changed vs the saved snapshot, the UI does a no-op “save” (it just exits edit mode).
- On success, the UI updates the row totals locally and exits edit mode.
- Firestore write behavior:
  - updates `employees/{staffTaskId}.baseRate` when changed
  - updates `employees/{staffTaskId}.videoRate` when changed
  - writes/merges the monthly snapshot at `employees/{staffTaskId}/payments/{YYYY_MM}`

4) Monthly Summary (previous month only)

- Separately, the page also loads `fetchSalaries(prevMonth)`.
- If the previous month has no “done” events at all, this section stays hidden.
- For each previous-month employee row, the user can optionally Edit/Save (same behavior as step 3) and then:
  - press “Accept” to accrue that month into the running balance.

5) Accept (accrue previous month into balance)

- Clicking “Accept” calls `salaryAccept` with `{ month: prevMonth, staffTaskId, baseRate, videosCount, videoRate, bonus, events }`.
- The backend transaction:
  - prevents double-processing if `processedAt` already exists on the monthly snapshot doc
  - adds that month’s `total` to `employees/{staffTaskId}.currentBalance`
  - marks the month snapshot as processed (`processedAt`, `processedAmount`, etc)
- The UI reflects this by:
  - updating `currentBalance` in both current and previous month lists
  - showing “Processed” (disabled) for that month

6) Pay (reduce balance + create a transaction record)

- Clicking “Pay” switches the row into an inline “paying” state (amount input + Confirm/Cancel), then calls `salaryPay({ staffTaskId, amount })`.
- The backend transaction:
  - rejects paying more than the current balance
  - subtracts from `employees/{staffTaskId}.currentBalance`
  - creates a payment transaction doc under `employees/{staffTaskId}/payments/{autoId}` with `type: 'payment'`
- The UI updates the displayed balance and triggers a refresh of the history if the row is expanded.

7) Payment history (lazy loaded)

- When an employee row is expanded, the UI calls `salaryHistory` once (cached per staff id) to fetch recent payment transactions.
- The UI shows a simple table: date, amount, and balanceAfter.

Environment requirements

- Salaries depends on all of the following being set:
  - Firebase client env vars (Auth)
  - `VITE_SALARIES_URL` and `VITE_SALARY_SAVE_URL`
  - For accrual/payment: `VITE_SALARY_ACCEPT_URL`, `VITE_SALARY_PAY_URL`, `VITE_SALARY_HISTORY_URL`
- All endpoints require a Firebase Auth bearer token, and the caller email must be allowlisted.

Behavior

- One collapse card per employee
- Has a view toggle next to the month selector:
  - Formula view
  - Table view (sticky header)
- Edit mode uses inline inputs
- Save happens only on the check icon
- If nothing changed, Save is a no-op
- Shows employee `currentBalance` and provides a “Pay” action
- Recommendation count is read-only (derived from ClickUp Recommendation checkbox); the editable value is the recommendation rate (`videoRate`, ₪/vid, default 50)
- Shows a “Monthly Summary” section for the previous month (collapsible, default collapsed) with an “Accept” action that:
  - Adds that month’s total to `currentBalance`
  - Marks the month as processed
- Expanded view shows payment transactions (latest-first)

Table view details
- Columns: Employee / Events / Recommendation / Bonus / Total
- Numeric columns are centered

Implementation reference: [src/pages/SalariesPage.tsx](../src/pages/SalariesPage.tsx).

---

## Firebase/Firestore configuration note (UI)

Some pages require Firebase to be configured to read Firestore.

- If Firebase env vars are not configured, the History page displays a “Firebase is not configured” message instead of attempting reads.
- Dashboard/History are designed around Firestore documents (latest dashboard + monthly `snapshots`).

If you want, I can add a short “How to run locally” section here (what `VITE_*` env vars are expected and where they’re used), but I didn’t include it by default to keep this doc focused on how the UI looks/behaves.
