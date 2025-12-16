import type { DashboardMetrics, YYYYMM } from '../dashboard/types';

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

export interface SnapshotRecord {
  month: YYYYMM;
  metrics: DashboardMetrics;
  diffFromPreviousPct: DiffObject;
  computedAt: string; // ISO
  version: 'v1';
}
