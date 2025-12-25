import type { DashboardMetrics, YYYYMM } from '@/lib/dashboard/types';

export interface DiffCountLeaf {
  valuePct: number | null;
}

export interface DiffMoneyLeaf {
  grossPct: number | null;
  netPct: number | null;
}

export interface DiffObject {
  financial: {
    monthlyRevenue: DiffMoneyLeaf;
    expectedCashflow: DiffMoneyLeaf;
    expectedExpenses: DiffMoneyLeaf;
  };

  marketing: {
    totalLeads: DiffCountLeaf;
    relevantLeads: DiffCountLeaf;
    landingVisits: DiffCountLeaf;
    landingSignups: DiffCountLeaf;
    landingConversionPct: DiffCountLeaf;
    followersEndOfMonth: DiffCountLeaf;
    followersDeltaMonth: DiffCountLeaf;
  };

  sales: {
    avgRevenuePerDeal: DiffMoneyLeaf;
    salesCalls: DiffCountLeaf;
    closures: DiffCountLeaf;
    closeRatePct: DiffCountLeaf;
  };

  operations: {
    activeCustomers: DiffCountLeaf;
    cancellations: DiffCountLeaf;
    referralsWordOfMouth: DiffCountLeaf;
    returningCustomers: DiffCountLeaf;
  };
}

// Firestore shape written by the refresh function.
export interface SnapshotDoc {
  version: 'v1';
  month: YYYYMM;
  computedAt: string; // ISO
  metrics: DashboardMetrics;
  diffFromPreviousPct: DiffObject;
}

// Alias used by the export engine and docs (matches backend naming).
export type SnapshotRecord = SnapshotDoc;
