"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeSalesMetrics = computeSalesMetrics;
const dataContract_1 = require("../config/dataContract");
const month_1 = require("../time/month");
const helpers_1 = require("./helpers");
function getCloseMs(lead) {
    return lead.closedMs ?? lead.updatedMs ?? null;
}
function computeSalesMetrics(input) {
    let salesCallsCount = 0;
    let closuresCount = 0;
    for (const lead of input.leads) {
        // salesCalls: leads created in month where status != New Lead
        if (lead.createdMs != null && (0, month_1.isWithinMonth)(lead.createdMs, input.range)) {
            if (lead.status != null && !(0, helpers_1.ciEquals)(lead.status, dataContract_1.CLICKUP_STATUS.newLead)) {
                salesCallsCount += 1;
            }
        }
        // closures: Closed Won in month by close date
        if ((0, helpers_1.ciEquals)(lead.status, dataContract_1.CLICKUP_STATUS.closedWon)) {
            const closeMs = getCloseMs(lead);
            if (closeMs != null && (0, month_1.isWithinMonth)(closeMs, input.range)) {
                closuresCount += 1;
            }
        }
    }
    const avgNotes = [];
    let avgGross = null;
    let avgNet = null;
    if (closuresCount === 0) {
        avgNotes.push('closedWonCount == 0 => null');
    }
    else if (input.monthlyRevenue.grossILS == null || input.monthlyRevenue.netILS == null) {
        avgNotes.push('monthlyRevenue missing => null');
    }
    else {
        avgGross = input.monthlyRevenue.grossILS / closuresCount;
        avgNet = input.monthlyRevenue.netILS / closuresCount;
    }
    const avgRevenuePerDeal = (0, helpers_1.currencyMetric)('computed', { grossILS: avgGross, netILS: avgNet }, avgNotes);
    const salesCalls = (0, helpers_1.countMetric)('clickup', salesCallsCount, ['Leads created in month where status != New Lead']);
    const closures = (0, helpers_1.countMetric)('clickup', closuresCount, ['Closed Won deals with closeDate in month']);
    const closeRatePct = (0, helpers_1.percentMetric)('computed', salesCallsCount === 0 ? null : (closuresCount / salesCallsCount) * 100, salesCallsCount === 0 ? ['salesCalls == 0 => null'] : undefined);
    return { avgRevenuePerDeal, salesCalls, closures, closeRatePct };
}
