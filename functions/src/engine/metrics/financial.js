"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeFinancialMetrics = computeFinancialMetrics;
const dataContract_1 = require("../config/dataContract");
const vat_1 = require("../vat/vat");
const month_1 = require("../time/month");
const helpers_1 = require("./helpers");
function getCloseMs(lead, notes) {
    if (lead.closedMs != null)
        return lead.closedMs;
    if (lead.updatedMs != null) {
        notes.push('Close date missing; used date_updated as closeDate proxy');
        return lead.updatedMs;
    }
    return null;
}
function computeFinancialMetrics(input) {
    const revenueNotes = ['Budget treated as gross ILS; net computed with VAT 18%'];
    let revenueGross = 0;
    let revenueNet = 0;
    let revenueCount = 0;
    for (const lead of input.leads) {
        if (!(0, helpers_1.ciEquals)(lead.status, dataContract_1.CLICKUP_STATUS.closedWon))
            continue;
        const closeMs = getCloseMs(lead, revenueNotes);
        if (closeMs == null || !(0, month_1.isWithinMonth)(closeMs, input.range))
            continue;
        const amounts = (0, vat_1.ensureNetGross)({ grossILS: lead.budgetGrossILS, netILS: null });
        if (amounts.grossILS == null || amounts.netILS == null)
            continue;
        revenueGross += amounts.grossILS;
        revenueNet += amounts.netILS;
        revenueCount += 1;
    }
    const monthlyRevenue = (0, helpers_1.currencyMetric)('clickup', revenueCount ? { grossILS: revenueGross, netILS: revenueNet } : { grossILS: null, netILS: null }, revenueNotes);
    // Expected cashflow (METRICS_SPEC v0.2) implemented using available fields:
    // - Budget = full amount (gross)
    // - Paid Amount = deposit already paid (gross)
    // - Deposit date proxy = closeDate (date_closed else date_updated)
    // - Event date proxy = requestedDate
    const cashflowNotes = [
        'Uses requestedDate as event date proxy',
        'Uses Paid Amount as deposit (gross ILS)',
        'Uses closeDate (date_closed/date_updated) as deposit date proxy',
        'Budget treated as gross ILS; net computed with VAT 18%',
    ];
    let cashflowGross = 0;
    let cashflowNet = 0;
    let cashflowIncluded = 0;
    for (const lead of input.leads) {
        if ((0, helpers_1.ciEquals)(lead.status, dataContract_1.CLICKUP_STATUS.billing))
            continue; // excluded
        const eventDateMs = lead.requestedDateMs;
        if (eventDateMs == null)
            continue;
        const inEventMonth = (0, month_1.isWithinMonth)(eventDateMs, input.range);
        const closeMs = getCloseMs(lead, cashflowNotes);
        const depositThisMonth = closeMs != null && (0, month_1.isWithinMonth)(closeMs, input.range);
        const full = (0, vat_1.ensureNetGross)({ grossILS: lead.budgetGrossILS, netILS: null });
        const deposit = (0, vat_1.ensureNetGross)({ grossILS: lead.paidAmountGrossILS, netILS: null });
        // Rules:
        // 1) Closed this month + event this month → full amount
        // 2) Closed earlier + event this month → full minus deposit already paid
        // 3) Deposit paid this month (even if event future) → deposit
        // (Billing excluded above)
        let includedGross = null;
        if (inEventMonth && depositThisMonth) {
            includedGross = full.grossILS;
        }
        else if (inEventMonth && closeMs != null && closeMs < input.range.startMs) {
            if (full.grossILS != null) {
                const dep = deposit.grossILS ?? 0;
                includedGross = Math.max(0, full.grossILS - dep);
            }
        }
        else if (!inEventMonth && depositThisMonth) {
            includedGross = deposit.grossILS;
        }
        if (includedGross == null)
            continue;
        const included = (0, vat_1.ensureNetGross)({ grossILS: includedGross, netILS: null });
        if (included.grossILS == null || included.netILS == null)
            continue;
        cashflowGross += included.grossILS;
        cashflowNet += included.netILS;
        cashflowIncluded += 1;
    }
    const expectedCashflow = (0, helpers_1.currencyMetric)('clickup', cashflowIncluded ? { grossILS: cashflowGross, netILS: cashflowNet } : { grossILS: null, netILS: null }, cashflowNotes);
    // Expected expenses
    const expenseNotes = ['Expense Amount treated as gross ILS; net computed with VAT 18%'];
    let expenseGross = 0;
    let expenseNet = 0;
    let expenseCount = 0;
    for (const exp of input.expenses) {
        if (exp.expenseDateMs == null || !(0, month_1.isWithinMonth)(exp.expenseDateMs, input.range))
            continue;
        const amounts = (0, vat_1.ensureNetGross)({ grossILS: exp.amountGrossILS, netILS: null });
        if (amounts.grossILS == null || amounts.netILS == null)
            continue;
        expenseGross += amounts.grossILS;
        expenseNet += amounts.netILS;
        expenseCount += 1;
    }
    const expectedExpenses = (0, helpers_1.currencyMetric)('clickup', expenseCount ? { grossILS: expenseGross, netILS: expenseNet } : { grossILS: null, netILS: null }, expenseNotes);
    return { monthlyRevenue, expectedCashflow, expectedExpenses };
}
