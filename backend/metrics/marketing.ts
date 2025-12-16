import type { CountMetric, PercentMetric, YYYYMM } from '../dashboard/types';
import { CLICKUP_SOURCE, CLICKUP_STATUS } from '../config/dataContract';
import type { NormalizedLead } from '../normalize/clickup';
import type { MonthRange } from '../time/month';
import { isWithinMonth } from '../time/month';
import { ciEquals, countMetric, percentMetric } from './helpers';

export interface MarketingMetricsInput {
  month: YYYYMM;
  range: MonthRange;
  leads: ReadonlyArray<NormalizedLead>;
}

export interface MarketingMetricsOutput {
  totalLeads: CountMetric;
  relevantLeads: CountMetric;
  landingVisits: CountMetric;
  landingSignups: CountMetric;
  landingConversionPct: PercentMetric;
}

export function computeMarketingMetrics(input: MarketingMetricsInput): MarketingMetricsOutput {
  let total = 0;
  let notRelevantLoss = 0;
  let landing = 0;

  for (const lead of input.leads) {
    if (lead.createdMs == null || !isWithinMonth(lead.createdMs, input.range)) continue;
    total += 1;

    if (ciEquals(lead.status, CLICKUP_STATUS.closedLoss) && ciEquals(lead.lossReason, 'Not Relevant')) {
      notRelevantLoss += 1;
    }

    if (ciEquals(lead.source, CLICKUP_SOURCE.landingPage)) {
      landing += 1;
    }
  }

  const relevant = total - notRelevantLoss;

  const totalLeads = countMetric('clickup', total, ['Count of Incoming Leads tasks created in month']);
  const relevantLeads = countMetric('clickup', relevant, ['totalLeads minus Closed Loss with Loss Reason = Not Relevant']);

  const landingVisits = countMetric('clickup', landing, ['ClickUp proxy: Source = Landing Page']);
  const landingSignups = countMetric('clickup', landing, ['v1: same as landingVisits (ClickUp is authoritative)']);

  const landingConversionPct = percentMetric(
    'computed',
    landing === 0 ? null : (landing / landing) * 100,
    landing === 0 ? ['visits == 0 => null'] : ['v1: landingSignups equals landingVisits'],
  );

  return { totalLeads, relevantLeads, landingVisits, landingSignups, landingConversionPct };
}
