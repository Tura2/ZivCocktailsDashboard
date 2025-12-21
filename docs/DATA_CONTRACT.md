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

---

## 7. Usage Rules
- Dashboard jobs READ ClickUp
- Jobs WRITE Firestore only
- Electron NEVER writes ClickUp
