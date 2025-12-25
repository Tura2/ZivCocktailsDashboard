import type { SnapshotRecord } from '@/lib/snapshots/types';

type Category = 'Financial' | 'Marketing' | 'Sales' | 'Operations';

type ValueKind = 'count' | 'percent' | 'currency_gross' | 'currency_net';

type DiffKind = 'valuePct' | 'grossPct' | 'netPct';

type Path = string[];

export type SnapshotExportRow = {
  month: string;
  computedAt: string;
  category: Category;
  metricKey: string;
  metricLabel: string;
  valueKind: ValueKind;
  value: number | null;
  diffKind: DiffKind;
  diffPct: number | null;
};

type RowDescriptor = {
  category: Category;
  metricKey: string;
  metricLabel: string;
  valueKind: ValueKind;
  valuePath: Path; // inside snapshot.metrics
  diffKind: DiffKind;
  diffPath: Path; // inside snapshot.diffFromPreviousPct
};

const ROWS: RowDescriptor[] = [
  // Financial
  {
    category: 'Financial',
    metricKey: 'financial.monthlyRevenue.grossILS',
    metricLabel: 'Monthly revenue (gross ILS)',
    valueKind: 'currency_gross',
    valuePath: ['financial', 'monthlyRevenue', 'grossILS'],
    diffKind: 'grossPct',
    diffPath: ['financial', 'monthlyRevenue', 'grossPct'],
  },
  {
    category: 'Financial',
    metricKey: 'financial.monthlyRevenue.netILS',
    metricLabel: 'Monthly revenue (net ILS)',
    valueKind: 'currency_net',
    valuePath: ['financial', 'monthlyRevenue', 'netILS'],
    diffKind: 'netPct',
    diffPath: ['financial', 'monthlyRevenue', 'netPct'],
  },
  {
    category: 'Financial',
    metricKey: 'financial.expectedCashflow.grossILS',
    metricLabel: 'Expected cashflow (gross ILS)',
    valueKind: 'currency_gross',
    valuePath: ['financial', 'expectedCashflow', 'grossILS'],
    diffKind: 'grossPct',
    diffPath: ['financial', 'expectedCashflow', 'grossPct'],
  },
  {
    category: 'Financial',
    metricKey: 'financial.expectedCashflow.netILS',
    metricLabel: 'Expected cashflow (net ILS)',
    valueKind: 'currency_net',
    valuePath: ['financial', 'expectedCashflow', 'netILS'],
    diffKind: 'netPct',
    diffPath: ['financial', 'expectedCashflow', 'netPct'],
  },
  {
    category: 'Financial',
    metricKey: 'financial.expectedExpenses.grossILS',
    metricLabel: 'Expected expenses (gross ILS)',
    valueKind: 'currency_gross',
    valuePath: ['financial', 'expectedExpenses', 'grossILS'],
    diffKind: 'grossPct',
    diffPath: ['financial', 'expectedExpenses', 'grossPct'],
  },
  {
    category: 'Financial',
    metricKey: 'financial.expectedExpenses.netILS',
    metricLabel: 'Expected expenses (net ILS)',
    valueKind: 'currency_net',
    valuePath: ['financial', 'expectedExpenses', 'netILS'],
    diffKind: 'netPct',
    diffPath: ['financial', 'expectedExpenses', 'netPct'],
  },

  // Marketing
  {
    category: 'Marketing',
    metricKey: 'marketing.totalLeads',
    metricLabel: 'Total leads',
    valueKind: 'count',
    valuePath: ['marketing', 'totalLeads', 'value'],
    diffKind: 'valuePct',
    diffPath: ['marketing', 'totalLeads', 'valuePct'],
  },
  {
    category: 'Marketing',
    metricKey: 'marketing.relevantLeads',
    metricLabel: 'Relevant leads',
    valueKind: 'count',
    valuePath: ['marketing', 'relevantLeads', 'value'],
    diffKind: 'valuePct',
    diffPath: ['marketing', 'relevantLeads', 'valuePct'],
  },
  {
    category: 'Marketing',
    metricKey: 'marketing.landingVisits',
    metricLabel: 'Landing visits',
    valueKind: 'count',
    valuePath: ['marketing', 'landingVisits', 'value'],
    diffKind: 'valuePct',
    diffPath: ['marketing', 'landingVisits', 'valuePct'],
  },
  {
    category: 'Marketing',
    metricKey: 'marketing.landingSignups',
    metricLabel: 'Landing signups',
    valueKind: 'count',
    valuePath: ['marketing', 'landingSignups', 'value'],
    diffKind: 'valuePct',
    diffPath: ['marketing', 'landingSignups', 'valuePct'],
  },
  {
    category: 'Marketing',
    metricKey: 'marketing.landingConversionPct',
    metricLabel: 'Landing conversion (%)',
    valueKind: 'percent',
    valuePath: ['marketing', 'landingConversionPct', 'value'],
    diffKind: 'valuePct',
    diffPath: ['marketing', 'landingConversionPct', 'valuePct'],
  },
  {
    category: 'Marketing',
    metricKey: 'marketing.followersEndOfMonth',
    metricLabel: 'Followers (end of month)',
    valueKind: 'count',
    valuePath: ['marketing', 'followersEndOfMonth', 'value'],
    diffKind: 'valuePct',
    diffPath: ['marketing', 'followersEndOfMonth', 'valuePct'],
  },
  {
    category: 'Marketing',
    metricKey: 'marketing.followersDeltaMonth',
    metricLabel: 'Followers Δ (month)',
    valueKind: 'count',
    valuePath: ['marketing', 'followersDeltaMonth', 'value'],
    diffKind: 'valuePct',
    diffPath: ['marketing', 'followersDeltaMonth', 'valuePct'],
  },

  // Sales
  {
    category: 'Sales',
    metricKey: 'sales.avgRevenuePerDeal.grossILS',
    metricLabel: 'Avg revenue / deal (gross ILS)',
    valueKind: 'currency_gross',
    valuePath: ['sales', 'avgRevenuePerDeal', 'grossILS'],
    diffKind: 'grossPct',
    diffPath: ['sales', 'avgRevenuePerDeal', 'grossPct'],
  },
  {
    category: 'Sales',
    metricKey: 'sales.avgRevenuePerDeal.netILS',
    metricLabel: 'Avg revenue / deal (net ILS)',
    valueKind: 'currency_net',
    valuePath: ['sales', 'avgRevenuePerDeal', 'netILS'],
    diffKind: 'netPct',
    diffPath: ['sales', 'avgRevenuePerDeal', 'netPct'],
  },
  {
    category: 'Sales',
    metricKey: 'sales.salesCalls',
    metricLabel: 'Sales calls',
    valueKind: 'count',
    valuePath: ['sales', 'salesCalls', 'value'],
    diffKind: 'valuePct',
    diffPath: ['sales', 'salesCalls', 'valuePct'],
  },
  {
    category: 'Sales',
    metricKey: 'sales.closures',
    metricLabel: 'Closures',
    valueKind: 'count',
    valuePath: ['sales', 'closures', 'value'],
    diffKind: 'valuePct',
    diffPath: ['sales', 'closures', 'valuePct'],
  },
  {
    category: 'Sales',
    metricKey: 'sales.closeRatePct',
    metricLabel: 'Close rate (%)',
    valueKind: 'percent',
    valuePath: ['sales', 'closeRatePct', 'value'],
    diffKind: 'valuePct',
    diffPath: ['sales', 'closeRatePct', 'valuePct'],
  },

  // Operations
  {
    category: 'Operations',
    metricKey: 'operations.activeCustomers',
    metricLabel: 'Active customers',
    valueKind: 'count',
    valuePath: ['operations', 'activeCustomers', 'value'],
    diffKind: 'valuePct',
    diffPath: ['operations', 'activeCustomers', 'valuePct'],
  },
  {
    category: 'Operations',
    metricKey: 'operations.cancellations',
    metricLabel: 'Cancellations',
    valueKind: 'count',
    valuePath: ['operations', 'cancellations', 'value'],
    diffKind: 'valuePct',
    diffPath: ['operations', 'cancellations', 'valuePct'],
  },
  {
    category: 'Operations',
    metricKey: 'operations.referralsWordOfMouth',
    metricLabel: 'Referrals (word of mouth)',
    valueKind: 'count',
    valuePath: ['operations', 'referralsWordOfMouth', 'value'],
    diffKind: 'valuePct',
    diffPath: ['operations', 'referralsWordOfMouth', 'valuePct'],
  },
  {
    category: 'Operations',
    metricKey: 'operations.returningCustomers',
    metricLabel: 'Returning customers',
    valueKind: 'count',
    valuePath: ['operations', 'returningCustomers', 'value'],
    diffKind: 'valuePct',
    diffPath: ['operations', 'returningCustomers', 'valuePct'],
  },
];

function getByPath(obj: unknown, path: Path): unknown {
  let cur: any = obj;
  for (const key of path) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[key];
  }
  return cur;
}

function toNumberOrNull(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v !== 'number') return null;
  if (!Number.isFinite(v)) return null;
  return v;
}

export function snapshotToExportRows(snapshot: SnapshotRecord): SnapshotExportRow[] {
  return ROWS.map((d) => {
    const value = toNumberOrNull(getByPath(snapshot.metrics, d.valuePath));
    const diffPct = toNumberOrNull(getByPath(snapshot.diffFromPreviousPct, d.diffPath));
    return {
      month: snapshot.month,
      computedAt: snapshot.computedAt,
      category: d.category,
      metricKey: d.metricKey,
      metricLabel: d.metricLabel,
      valueKind: d.valueKind,
      value,
      diffKind: d.diffKind,
      diffPct,
    };
  });
}

export function assertExportRowsMatchSnapshot(snapshot: SnapshotRecord, rows: SnapshotExportRow[]) {
  const expected = snapshotToExportRows(snapshot);
  if (expected.length !== rows.length) {
    throw new Error(`Export validation failed: row count mismatch (${rows.length} vs ${expected.length})`);
  }

  for (let i = 0; i < expected.length; i++) {
    const a = expected[i];
    const b = rows[i];
    if (a.metricKey !== b.metricKey) throw new Error(`Export validation failed: row ${i} metricKey mismatch (${b.metricKey} vs ${a.metricKey})`);
    if (a.value !== b.value) throw new Error(`Export validation failed: row ${i} value mismatch for ${a.metricKey}`);
    if (a.diffPct !== b.diffPct) throw new Error(`Export validation failed: row ${i} diff mismatch for ${a.metricKey}`);
  }
}
