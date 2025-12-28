import type { CountMetric, CurrencyMetric, PercentMetric, YYYYMM } from '../dashboard/types';
import { CLICKUP_STATUS } from '../config/dataContract';
import type { NormalizedLead } from '../normalize/clickup';
import type { MonthRange } from '../time/month';
import { isWithinMonth } from '../time/month';
import { ciEquals, countMetric, currencyMetric, percentMetric } from './helpers';

export interface SalesMetricsInput {
  month: YYYYMM;
  range: MonthRange;
  leads: ReadonlyArray<NormalizedLead>;
  monthlyRevenue: CurrencyMetric;
  extraClosedWonCloseMs?: ReadonlyArray<number | null>;
}

export interface SalesMetricsOutput {
  avgRevenuePerDeal: CurrencyMetric;
  salesCalls: CountMetric;
  closures: CountMetric;
  closeRatePct: PercentMetric;
}

function getCloseMs(lead: NormalizedLead): number | null {
  return lead.closedMs ?? lead.updatedMs ?? null;
}

export function computeSalesMetrics(input: SalesMetricsInput): SalesMetricsOutput {
  let salesCallsCount = 0;
  let closuresCount = 0;

  for (const lead of input.leads) {
    // salesCalls: leads created in month where status != New Lead
    if (lead.createdMs != null && isWithinMonth(lead.createdMs, input.range)) {
      if (lead.status != null && !ciEquals(lead.status, CLICKUP_STATUS.newLead)) {
        salesCallsCount += 1;
      }
    }

    // closures: Closed Won in month by close date
    if (ciEquals(lead.status, CLICKUP_STATUS.closedWon)) {
      const closeMs = getCloseMs(lead);
      if (closeMs != null && isWithinMonth(closeMs, input.range)) {
        closuresCount += 1;
      }
    }
  }

  for (const closeMs of input.extraClosedWonCloseMs ?? []) {
    if (closeMs != null && isWithinMonth(closeMs, input.range)) {
      closuresCount += 1;
    }
  }

  const avgNotes: string[] = [];
  let avgGross: number | null = null;
  let avgNet: number | null = null;

  if (closuresCount === 0) {
    avgNotes.push('closedWonCount == 0 => null');
  } else if (input.monthlyRevenue.grossILS == null || input.monthlyRevenue.netILS == null) {
    avgNotes.push('monthlyRevenue missing => null');
  } else {
    avgGross = input.monthlyRevenue.grossILS / closuresCount;
    avgNet = input.monthlyRevenue.netILS / closuresCount;
  }

  const avgRevenuePerDeal = currencyMetric('computed', { grossILS: avgGross, netILS: avgNet }, avgNotes);
  const salesCalls = countMetric('clickup', salesCallsCount, ['Leads created in month where status != New Lead']);
  const closures = countMetric('clickup', closuresCount, ['Closed Won deals with closeDate in month']);

  const closeRatePct = percentMetric(
    'computed',
    salesCallsCount === 0 ? null : (closuresCount / salesCallsCount) * 100,
    salesCallsCount === 0 ? ['salesCalls == 0 => null'] : undefined,
  );

  return { avgRevenuePerDeal, salesCalls, closures, closeRatePct };
}
