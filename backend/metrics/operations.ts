import type { CountMetric, YYYYMM } from '../dashboard/types';
import { CLICKUP_SOURCE, CLICKUP_STATUS } from '../config/dataContract';
import type { NormalizedEvent, NormalizedLead } from '../normalize/clickup';
import type { MonthRange } from '../time/month';
import { isWithinMonth } from '../time/month';
import { ciEquals, countMetric } from './helpers';

export interface OperationsMetricsInput {
  month: YYYYMM;
  range: MonthRange;
  leads: ReadonlyArray<NormalizedLead>;
  events: ReadonlyArray<NormalizedEvent>;
  computedAt: Date;
}

export interface OperationsMetricsOutput {
  activeCustomers: CountMetric;
  cancellations: CountMetric;
  referralsWordOfMouth: CountMetric;
  returningCustomers: CountMetric;
}

function getCloseMs(lead: NormalizedLead): number | null {
  return lead.closedMs ?? lead.updatedMs ?? null;
}

export function computeOperationsMetrics(input: OperationsMetricsInput): OperationsMetricsOutput {
  const nowMs = input.computedAt.getTime();

  // Active customers: Event Calendar tasks with status in {booked, staffing, logistics, ready} and eventDate >= now
  const activeStatuses = new Set([
    CLICKUP_STATUS.booked.toLowerCase(),
    CLICKUP_STATUS.staffing.toLowerCase(),
    CLICKUP_STATUS.logistics.toLowerCase(),
    CLICKUP_STATUS.ready.toLowerCase(),
  ]);

  let active = 0;
  for (const ev of input.events) {
    const status = ev.status?.toLowerCase() ?? null;
    if (!status || !activeStatuses.has(status)) continue;
    if (ev.requestedDateMs == null) continue;
    if (ev.requestedDateMs >= nowMs) active += 1;
  }

  // Cancellations v1: current status == Cancelled AND date_updated in month
  let cancellations = 0;
  for (const ev of input.events) {
    if (!ciEquals(ev.status, CLICKUP_STATUS.cancelled)) continue;
    if (ev.updatedMs == null) continue;
    if (isWithinMonth(ev.updatedMs, input.range)) cancellations += 1;
  }

  // Referrals Word of Mouth: Incoming Leads created in month where Source = Word of Mouth
  let referrals = 0;
  for (const lead of input.leads) {
    if (lead.createdMs == null || !isWithinMonth(lead.createdMs, input.range)) continue;
    if (ciEquals(lead.source, CLICKUP_SOURCE.wordOfMouth)) referrals += 1;
  }

  // Returning customers: phone of lead created in month exists in ANY historical Closed Won
  const historicalClosedWonPhones = new Set<string>();
  const returningPhonesThisMonth = new Set<string>();

  for (const lead of input.leads) {
    if (!ciEquals(lead.status, CLICKUP_STATUS.closedWon)) continue;
    const closeMs = getCloseMs(lead);
    if (closeMs == null || closeMs >= input.range.startMs) continue;
    if (lead.phoneNormalized) historicalClosedWonPhones.add(lead.phoneNormalized);
  }

  for (const lead of input.leads) {
    if (lead.createdMs == null || !isWithinMonth(lead.createdMs, input.range)) continue;
    if (!lead.phoneNormalized) continue;
    if (historicalClosedWonPhones.has(lead.phoneNormalized)) returningPhonesThisMonth.add(lead.phoneNormalized);
  }

  const activeCustomers = countMetric('clickup', active, ['Event Calendar: statuses {booked, staffing, logistics, ready} and eventDate >= computedAt']);
  const cancellationsMetric = countMetric('clickup', cancellations, ['v1: status == Cancelled and date_updated in month']);
  const referralsWordOfMouth = countMetric('clickup', referrals, ['Incoming Leads: Source = Word of Mouth, created in month']);
  const returningCustomers = countMetric('clickup', returningPhonesThisMonth.size, ['Unique normalized phones created in month that match historical Closed Won phones']);

  return {
    activeCustomers,
    cancellations: cancellationsMetric,
    referralsWordOfMouth,
    returningCustomers,
  };
}
