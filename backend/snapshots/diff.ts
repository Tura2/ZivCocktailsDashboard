import type { DashboardMetrics } from '../dashboard/types';
import type { DiffCountLeaf, DiffMoneyLeaf, DiffObject } from './types';

/**
 * deltaPct(current, previous) = ((current - previous) / previous) * 100
 *
 * Rules:
 * - If previous is null or 0 => null
 * - If current is null => null
 * - Rounded to 2 decimals for stable output (Math.round(x * 100) / 100), applied only once at the end
 */
export function deltaPct(current: number | null, previous: number | null): number | null {
  if (current == null) return null;
  if (previous == null) return null;
  if (previous === 0) return null;

  const raw = ((current - previous) / previous) * 100;
  if (!Number.isFinite(raw)) return null;

  return round2(raw);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function diffCountLeaf(current: number | null, previous: number | null): DiffCountLeaf {
  return { valuePct: deltaPct(current, previous) };
}

function diffMoneyLeaf(
  current: { grossILS: number | null; netILS: number | null },
  previous: { grossILS: number | null; netILS: number | null },
): DiffMoneyLeaf {
  return {
    grossPct: deltaPct(current.grossILS, previous.grossILS),
    netPct: deltaPct(current.netILS, previous.netILS),
  };
}

export function computeDiffFromPreviousPct(current: DashboardMetrics, previous: DashboardMetrics): DiffObject {
  return {
    financial: {
      monthlyRevenue: diffMoneyLeaf(current.financial.monthlyRevenue, previous.financial.monthlyRevenue),
      expectedCashflow: diffMoneyLeaf(current.financial.expectedCashflow, previous.financial.expectedCashflow),
      expectedExpenses: diffMoneyLeaf(current.financial.expectedExpenses, previous.financial.expectedExpenses),
    },

    marketing: {
      totalLeads: diffCountLeaf(current.marketing.totalLeads.value, previous.marketing.totalLeads.value),
      relevantLeads: diffCountLeaf(current.marketing.relevantLeads.value, previous.marketing.relevantLeads.value),
      landingVisits: diffCountLeaf(current.marketing.landingVisits.value, previous.marketing.landingVisits.value),
      landingSignups: diffCountLeaf(current.marketing.landingSignups.value, previous.marketing.landingSignups.value),
      landingConversionPct: diffCountLeaf(
        current.marketing.landingConversionPct.value,
        previous.marketing.landingConversionPct.value,
      ),
      followersEndOfMonth: diffCountLeaf(
        current.marketing.followersEndOfMonth.value,
        previous.marketing.followersEndOfMonth.value,
      ),
      followersDeltaMonth: diffCountLeaf(
        current.marketing.followersDeltaMonth.value,
        previous.marketing.followersDeltaMonth.value,
      ),
    },

    sales: {
      avgRevenuePerDeal: diffMoneyLeaf(current.sales.avgRevenuePerDeal, previous.sales.avgRevenuePerDeal),
      salesCalls: diffCountLeaf(current.sales.salesCalls.value, previous.sales.salesCalls.value),
      closures: diffCountLeaf(current.sales.closures.value, previous.sales.closures.value),
      closeRatePct: diffCountLeaf(current.sales.closeRatePct.value, previous.sales.closeRatePct.value),
    },

    operations: {
      activeCustomers: diffCountLeaf(current.operations.activeCustomers.value, previous.operations.activeCustomers.value),
      cancellations: diffCountLeaf(current.operations.cancellations.value, previous.operations.cancellations.value),
      referralsWordOfMouth: diffCountLeaf(
        current.operations.referralsWordOfMouth.value,
        previous.operations.referralsWordOfMouth.value,
      ),
      returningCustomers: diffCountLeaf(
        current.operations.returningCustomers.value,
        previous.operations.returningCustomers.value,
      ),
    },
  };
}
