// Locked identifiers from docs/DATA_CONTRACT.md

export const CLICKUP = {
  spaceId: '90125747160',
  lists: {
    incomingLeads: '901214362127',
    eventCalendar: '901214362128',
    expenses: '901214544874',
  },
  fields: {
    phone: 'b9781217-a9fc-44e1-b152-c11f193c8839',
    email: '28a795ba-0ee5-4abf-86f6-142a965cd1f7',
    eventType: '4be9eb02-cdd2-41cd-9d8e-252cf488785d',
    budget: '09a72b8e-b74a-4034-8aff-f1b683c51650',
    requestedDate: '1660701a-1263-41cf-bb7a-79e3c3638aa3',
    source: 'c49330f0-35a0-4177-92ff-854655a7fc55',
    lossReason: 'c4c93671-a537-471b-80ae-0790d1fc2e84',
    participants: 'b31123ca-8aef-48b6-8f52-2bec892c70e8',
    paidAmount: '05c2f19f-8a46-41ab-8720-0ce2481c29cc',

    expenseAmount: '0d357de4-bb80-4a61-a83d-3b373e102904',
    expenseDate: '278accbb-c4a3-430f-ae3b-6076f96222b3',
    expenseCategory: 'f2d2746b-ed1a-4ef9-9321-80a9c8544e0a',
    expenseSupplier: 'ad3de6e9-c4a6-433a-ac9d-84ef0ad3e80d',
  },
} as const;

export const CLICKUP_STATUS = {
  newLead: 'New Lead',
  closedWon: 'Closed Won',
  closedLoss: 'Closed Lost',
  billing: 'Billing',
  cancelled: 'Cancelled',

  // Event Calendar operational statuses
  booked: 'booked',
  staffing: 'staffing',
  logistics: 'logistics',
  ready: 'ready',
} as const;

export const CLICKUP_SOURCE = {
  landingPage: 'Landing Page',
  wordOfMouth: 'Word of Mouth',
} as const;
