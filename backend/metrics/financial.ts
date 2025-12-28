import type { CurrencyMetric, YYYYMM } from '../dashboard/types';
import { CLICKUP_STATUS } from '../config/dataContract';
import type { NormalizedExpense, NormalizedLead } from '../normalize/clickup';
import { ensureNetGross } from '../vat/vat';
import type { MonthRange } from '../time/month';
import { isWithinMonth } from '../time/month';
import { ciEquals, currencyMetric } from './helpers';

export interface FinancialMetricsInput {
  month: YYYYMM;
  range: MonthRange;
  leads: ReadonlyArray<NormalizedLead>;
  expenses: ReadonlyArray<NormalizedExpense>;
  extraClosedWon?: ReadonlyArray<{ closeMs: number | null; budgetGrossILS: number | null; notes?: string[] }>;
}

export interface FinancialMetricsOutput {
  monthlyRevenue: CurrencyMetric;
  expectedCashflow: CurrencyMetric;
  expectedExpenses: CurrencyMetric;
}

function getCloseMs(lead: NormalizedLead, notes: string[]): number | null {
  if (lead.closedMs != null) return lead.closedMs;
  if (lead.updatedMs != null) {
    notes.push('Close date missing; used date_updated as closeDate proxy');
    return lead.updatedMs;
  }
  return null;
}

export function computeFinancialMetrics(input: FinancialMetricsInput): FinancialMetricsOutput {
  const revenueNotes: string[] = ['Budget treated as gross ILS; net computed with VAT 18%'];
  let revenueGross = 0;
  let revenueNet = 0;
  let revenueCount = 0;

  for (const lead of input.leads) {
    if (!ciEquals(lead.status, CLICKUP_STATUS.closedWon)) continue;
    const closeMs = getCloseMs(lead, revenueNotes);
    if (closeMs == null || !isWithinMonth(closeMs, input.range)) continue;

    const amounts = ensureNetGross({ grossILS: lead.budgetGrossILS, netILS: null });
    if (amounts.grossILS == null || amounts.netILS == null) continue;

    revenueGross += amounts.grossILS;
    revenueNet += amounts.netILS;
    revenueCount += 1;
  }

  // Also include deals that were moved out of Incoming Leads by automation (ClickBot) into Event Calendar.
  // Those tasks no longer appear in the Incoming Leads list at refresh time.
  for (const deal of input.extraClosedWon ?? []) {
    const closeMs = deal.closeMs;
    if (closeMs == null || !isWithinMonth(closeMs, input.range)) continue;

    if (deal.notes?.length) revenueNotes.push(...deal.notes);

    const amounts = ensureNetGross({ grossILS: deal.budgetGrossILS, netILS: null });
    if (amounts.grossILS == null || amounts.netILS == null) continue;

    revenueGross += amounts.grossILS;
    revenueNet += amounts.netILS;
    revenueCount += 1;
  }

  const monthlyRevenue = currencyMetric(
    'clickup',
    revenueCount ? { grossILS: revenueGross, netILS: revenueNet } : { grossILS: null, netILS: null },
    revenueNotes,
  );

  // Expected cashflow (METRICS_SPEC v0.2) implemented using available fields:
  // - Budget = full amount (gross)
  // - Paid Amount = deposit already paid (gross)
  // - Deposit date proxy = closeDate (date_closed else date_updated)
  // - Event date proxy = requestedDate
  const cashflowNotes: string[] = [
    'Uses requestedDate as event date proxy',
    'Uses Paid Amount as deposit (gross ILS)',
    'Uses closeDate (date_closed/date_updated) as deposit date proxy',
    'Budget treated as gross ILS; net computed with VAT 18%',
  ];

  let cashflowGross = 0;
  let cashflowNet = 0;
  let cashflowIncluded = 0;

  for (const lead of input.leads) {
    if (ciEquals(lead.status, CLICKUP_STATUS.billing)) continue; // excluded

    const eventDateMs = lead.requestedDateMs;
    if (eventDateMs == null) continue;

    const inEventMonth = isWithinMonth(eventDateMs, input.range);

    const closeMs = getCloseMs(lead, cashflowNotes);
    const depositThisMonth = closeMs != null && isWithinMonth(closeMs, input.range);

    const full = ensureNetGross({ grossILS: lead.budgetGrossILS, netILS: null });
    const deposit = ensureNetGross({ grossILS: lead.paidAmountGrossILS, netILS: null });

    // Rules:
    // 1) Closed this month + event this month → full amount
    // 2) Closed earlier + event this month → full minus deposit already paid
    // 3) Deposit paid this month (even if event future) → deposit
    // (Billing excluded above)
    let includedGross: number | null = null;

    if (inEventMonth && depositThisMonth) {
      includedGross = full.grossILS;
    } else if (inEventMonth && closeMs != null && closeMs < input.range.startMs) {
      if (full.grossILS != null) {
        const dep = deposit.grossILS ?? 0;
        includedGross = Math.max(0, full.grossILS - dep);
      }
    } else if (!inEventMonth && depositThisMonth) {
      includedGross = deposit.grossILS;
    }

    if (includedGross == null) continue;

    const included = ensureNetGross({ grossILS: includedGross, netILS: null });
    if (included.grossILS == null || included.netILS == null) continue;

    cashflowGross += included.grossILS;
    cashflowNet += included.netILS;
    cashflowIncluded += 1;
  }

  const expectedCashflow = currencyMetric(
    'clickup',
    cashflowIncluded ? { grossILS: cashflowGross, netILS: cashflowNet } : { grossILS: null, netILS: null },
    cashflowNotes,
  );

  // Expected expenses
  const expenseNotes: string[] = ['Expense Amount treated as gross ILS; net computed with VAT 18%'];
  let expenseGross = 0;
  let expenseNet = 0;
  let expenseCount = 0;

  for (const exp of input.expenses) {
    if (exp.expenseDateMs == null || !isWithinMonth(exp.expenseDateMs, input.range)) continue;
    const amounts = ensureNetGross({ grossILS: exp.amountGrossILS, netILS: null });
    if (amounts.grossILS == null || amounts.netILS == null) continue;
    expenseGross += amounts.grossILS;
    expenseNet += amounts.netILS;
    expenseCount += 1;
  }

  const expectedExpenses = currencyMetric(
    'clickup',
    expenseCount ? { grossILS: expenseGross, netILS: expenseNet } : { grossILS: null, netILS: null },
    expenseNotes,
  );

  return { monthlyRevenue, expectedCashflow, expectedExpenses };
}
