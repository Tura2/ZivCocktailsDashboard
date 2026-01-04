# Pre-deploy blockers / missing setup

This document lists the known issues that must be addressed (or consciously accepted) before deploying the app for real usage.

## 1) Missing integrations / credentials

### 1.1 Google Analytics for Landing metrics (BLOCKER)

**Problem**
- `marketing.landingVisits` and `marketing.landingConversionPct` are currently **not backed by Google Analytics**.
- Today, landing visits/signups are computed as a **ClickUp proxy** (Incoming Leads where Source = `Landing Page`).

**Impact**
- Landing metrics will not reflect real website traffic.
- `landingConversionPct` is effectively a placeholder (currently always `100%` when there is at least one landing lead).

**What’s missing**
- A real GA4 ingestion approach (frontend event tracking + backend reporting, or a server-side pull from GA Reporting APIs).
- Credentials / configuration for GA.

**Relevant code/docs**
- Current placeholder logic: [backend/metrics/marketing.ts](../backend/metrics/marketing.ts)
- Firebase config includes an optional measurement id: [src/lib/firebase.ts](../src/lib/firebase.ts)

---

### 1.2 Instagram API for follower metrics (BLOCKER)

**Problem**
- `marketing.followersEndOfMonth` and `marketing.followersDeltaMonth` require Instagram Graph API credentials.

**Impact**
- If Instagram is not configured, follower metrics will show `—` (null) and include notes like “Instagram client not configured”.

**What’s missing**
- `INSTAGRAM_ACCESS_TOKEN`
- `INSTAGRAM_IG_USER_ID`

**Where to configure**
- Cloud Functions secrets (recommended): used by the `refresh` function.
  - The function explicitly declares these secrets.

**Relevant code/docs**
- Secrets are used here: [functions/src/refresh/runRefresh.ts](../functions/src/refresh/runRefresh.ts)
- Engine contract notes: [docs/stages/F1_CLOUD_DATA_ENGINE.md](stages/F1_CLOUD_DATA_ENGINE.md)

---

## 2) UI fixes / UX defaults

### 2.1 History page defaults (DONE)

**Previously**
- History defaulted to “recent months”.
- Density toggle buttons were available.

**Now**
- History defaults to showing the **current year only** (e.g. 2026).
- The density toggle buttons are removed (History is always **Comfortable**).
- Month range dropdown defaults to current year; there is a checkbox to include the previous year (e.g. 2025).

Relevant file:
- [src/pages/HistoryPage.tsx](../src/pages/HistoryPage.tsx)

---

## 3) Documentation consistency

### 3.1 Stage docs must remain timeless (IN PROGRESS)

**Problem**
- A commit-based document is not a stable reference because commits always change.

**Fix**
- Keep implementation notes in the relevant stage docs + computation docs.
- Track remaining work here and in the roadmap.

Relevant docs:
- [docs/ROADMAP.md](ROADMAP.md)
- [docs/CLICKUP_COMPUTATION.md](CLICKUP_COMPUTATION.md)
- [docs/stages/F5_Dashboard_UI.md](stages/F5_Dashboard_UI.md)
- [docs/stages/F6_History_and_Trends.md](stages/F6_History_and_Trends.md)
