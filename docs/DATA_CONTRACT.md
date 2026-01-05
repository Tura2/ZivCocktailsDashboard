# Data Contract — Ziv Cocktails Dashboard

**Status:** v1.0 (locked)

This doc defines the **stable identifiers** and **field mappings** used by backend jobs when reading ClickUp.

Related docs:
- Product & invariants: [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md)
- Metric definitions & formulas: [METRICS_SPEC.md](METRICS_SPEC.md)

---

## 1. ClickUp Structure

### Space
- Space ID: 90125747160

### Core Lists
| Purpose | List Name | ID |
|------|---------|----|
| Leads / Deals | Incoming Leads | 901214362127 |
| Events | Event Calendar | 901214362128 |
| HR / Payroll | Staff Directory | 901214362129 |
| Expenses | Expenses | 901214544874 |
| Income Docs | Income (Invoices) | 901214544871 |

---

## 2. Incoming Leads – Field Mapping

| Logical Name | Field Name | Field ID | Type |
|------------|-----------|---------|------|
| phone | Phone (Space) | b9781217-a9fc-44e1-b152-c11f193c8839 | phone |
| email | Email | 28a795ba-0ee5-4abf-86f6-142a965cd1f7 | email |
| eventType | Event Type | 4be9eb02-cdd2-41cd-9d8e-252cf488785d | dropdown |
| budget | Budget | 09a72b8e-b74a-4034-8aff-f1b683c51650 | currency |
| requestedDate | Requested Date | 1660701a-1263-41cf-bb7a-79e3c3638aa3 | date |
| source | Source | c49330f0-35a0-4177-92ff-854655a7fc55 | dropdown |
| lossReason | Loss Reason | c4c93671-a537-471b-80ae-0790d1fc2e84 | dropdown |
| participants | Participants | b31123ca-8aef-48b6-8f52-2bec892c70e8 | number |
| paidAmount | Paid Amount | 05c2f19f-8a46-41ab-8720-0ce2481c29cc | currency |
| attempts | Attempts | b28b5532-5329-4087-bffd-61738f21a806 | dropdown |

---

## 3. Event Calendar
- Inherits most space fields
- Status lifecycle:
  - booked → staffing → logistics → ready → done → billing

### 3.1 Payroll / Salaries fields

These are used by the Salaries module (see [EMPLOYER_EVENTS_CALC.md](EMPLOYER_EVENTS_CALC.md)).

| Logical Name | Field Name | Field ID | Type |
|------------|-----------|---------|------|
| assignedStaff | Assigned Staff | 61f29c83-d538-4d62-97bb-c221572d2c47 | relationship |
| requestedDate | Requested Date | 1660701a-1263-41cf-bb7a-79e3c3638aa3 | date |
| recommendation | Recommendation | f11a51df-9a01-4eea-8d2f-dab88217d985 | checkbox |

---

## 4. Expenses

| Logical Name | Field | ID |
|------------|------|----|
| amount | Expense Amount | 0d357de4-bb80-4a61-a83d-3b373e102904 |
| date | Expense Date | 278accbb-c4a3-430f-ae3b-6076f96222b3 |
| category | Category | f2d2746b-ed1a-4ef9-9321-80a9c8544e0a |
| supplier | Supplier Name | ad3de6e9-c4a6-433a-ac9d-84ef0ad3e80d |
| icountId | iCount ID | 46aa14b0-ae48-4b5a-a2e0-56cf80ab015b |

---

## 5. Income (Invoices)
Used for **verification only**, not revenue computation.

| Field | Purpose |
|-----|--------|
| Amount | Cross-check totals |
| Doc Type | Invoice / Receipt |
| PDF Link | Validation |
| iCount ID | Deduplication |

---

## 6. Data Guarantees
- No critical data in descriptions
- Phone is unique identifier for customers
- Closed Won implies deposit paid
- iCount ID must be unique across Income + Expenses

## 6.1 ClickUp dropdown values (important)

Some ClickUp custom fields are `dropdown`/`drop_down` types (e.g. `source`, `lossReason`). In ClickUp’s API response, the `value` for these fields can come back as a **number** (an option index/order) rather than a human-readable string.

Engine rule:
- The backend normalizes dropdown values to the **option name** using the field’s `type_config.options`.
- Metric logic compares against names like `Landing Page`, `Word of Mouth`, and `Not Relevant`.

Status naming:
- Canonical loss status string used by the engine is `Closed Lost` (some historical data may contain `Closed Loss`).

---

## 7. Usage Rules
- Dashboard jobs READ ClickUp
- Jobs WRITE Firestore only
- Electron NEVER writes ClickUp
