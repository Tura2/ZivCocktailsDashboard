# Metrics Spec — Ziv Cocktails Dashboard

**Status:** v0.2 (locked)

This doc defines **metric names, sources, filters, and formulas** used by the backend computation engine.

Related docs:
- Product & invariants: [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md)
- ClickUp IDs & field mappings: [DATA_CONTRACT.md](DATA_CONTRACT.md)

## 0. Global Conventions

### Time Range
- Calendar month
  - monthStart = YYYY-MM-01 00:00
  - monthEnd = next month YYYY-MM-01 00:00 (exclusive)

### VAT
- Country: Israel
- VAT_RATE = **0.18 (hardcoded)**
- If only one amount exists:
  - net = gross / 1.18
  - gross = net * 1.18

---

## 1. 🟢 פיננסי ותזרים (Financial)

### 1.1 מחזור מכירה חודשי (Monthly Revenue)
**Source:** ClickUp – Incoming Leads / Event flow  
**Rule:** Deal is considered revenue ONLY if `status = Closed Won`

**Formula:**
- revenueGross = Σ(priceGross)  
- revenueNet = Σ(priceNet)

**Filters:**
- status == Closed Won
- closeDate ∈ month

**Production automation note (moved deals):**
- If a Closed Won task is moved from Incoming Leads → Event Calendar and becomes `booked`, the engine may still count it as revenue.
- In that case, the **closeDate** is taken from the ClickBot “Moved to Event Calendar … Closed Won” task comment timestamp.

---

### 1.2 תזרים צפוי החודש (Expected Cashflow)
**Complex conditional logic**

Include:
1. Closed this month + event this month → full amount
2. Closed earlier + event this month → full minus deposit already paid
3. Deposit paid this month (even if event future) → deposit
4. status == Billing → excluded

**Important:**
- Deposit counted only once
- Based on `Paid Amount` + deposit date

---

### 1.3 הוצאות צפויות החודש (Expenses)
**Source:** ClickUp – Expenses list

**Formula:**
- expenseDate ∈ month
- Sum Expense Amount (gross/net)

---

## 2. 🟠 שיווק ומשפך (Marketing)

### 2.1 סה"כ לידים
- Count tasks created in month

### 2.2 לידים רלוונטיים
- Total leads
- minus Closed Lost (historically sometimes appears as Closed Loss) with Loss Reason = Not Relevant

---

### 2.3 כניסות לדף נחיתה (Landing Page Visits)
**Source:** ClickUp ONLY  
**Definition:**
- Leads where `Source = Landing Page`
- Used as *traffic proxy* (no external API)

---

### 2.4 הרשמות דף נחיתה
- Same as landing visits (ClickUp is authoritative)

---

### 2.5 אחוז המרה
- landingSignups / landingVisits * 100

---

### 2.6 עוקבים (Followers)
**Stored values:**
- followersCountEndOfMonth
- followersDeltaMonth

Source: Instagram API (backend only)

---

## 3. 🔴 מכירות וביצועים (Sales)

### 3.1 ממוצע הכנסה לעסקה
- revenue / closedWonCount

### 3.2 שיחות מכירה
- Leads with status != New Lead

### 3.3 כמות סגירות
- Closed Won in month

**Production automation note (moved deals):**
- If the deal was moved to Event Calendar, the close month is determined by the ClickBot move-comment timestamp.

### 3.4 אחוזי סגירה
- closedWon / salesCalls * 100

---

## 4. 🔵 שירות ותפעול (Operations)

### 4.1 לקוחות פעילים
**Source:** Event Calendar  
**Definition:**
- status ∈ {booked, staffing, logistics, ready}
- eventDate >= now()

---

### 4.2 ביטולים
- status changed to Cancelled in month

---

### 4.3 פניות לקוחות (Referral Leads)
- Source = Word of Mouth
- created in month

---

### 4.4 לקוחות חוזרים
- Phone number of new lead exists in ANY historical Closed Won
- Phone normalized (+972 / leading 0)

---

## 5. Snapshot Rules
- Snapshot = FULL PREVIOUS MONTH ONLY
- Immutable
- Auto-generated if missing
- Diff % calculated vs previous snapshot
