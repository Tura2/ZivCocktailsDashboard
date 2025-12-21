export type YYYYMM = `${number}${number}${number}${number}-${number}${number}`;

export type MetricSource = 'clickup' | 'instagram' | 'computed';

export interface MetricMeta {
  source: MetricSource;
  notes?: string[];
}

export interface CurrencyMetric {
  grossILS: number | null;
  netILS: number | null;
  meta: MetricMeta;
}

export interface CountMetric {
  value: number | null;
  meta: MetricMeta;
}

export interface PercentMetric {
  value: number | null;
  meta: MetricMeta;
}

export interface DashboardMetrics {
  version: 'v1';
  month: YYYYMM;
  computedAt: string; // ISO

  financial: {
    monthlyRevenue: CurrencyMetric;
    expectedCashflow: CurrencyMetric;
    expectedExpenses: CurrencyMetric;
  };

  marketing: {
    totalLeads: CountMetric;
    relevantLeads: CountMetric;
    landingVisits: CountMetric;
    landingSignups: CountMetric;
    landingConversionPct: PercentMetric;
    followersEndOfMonth: CountMetric;
    followersDeltaMonth: CountMetric;
  };

  sales: {
    avgRevenuePerDeal: CurrencyMetric;
    salesCalls: CountMetric;
    closures: CountMetric;
    closeRatePct: PercentMetric;
  };

  operations: {
    activeCustomers: CountMetric;
    cancellations: CountMetric;
    referralsWordOfMouth: CountMetric;
    returningCustomers: CountMetric;
  };
}

// Firestore shape written by the refresh function.
export interface DashboardLatestDoc {
  version: 'v1';
  month: YYYYMM;
  computedAt: string; // ISO
  metrics: DashboardMetrics;
}
