"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeMarketingMetrics = computeMarketingMetrics;
const dataContract_1 = require("../config/dataContract");
const month_1 = require("../time/month");
const helpers_1 = require("./helpers");
function computeMarketingMetrics(input) {
    let total = 0;
    let notRelevantLoss = 0;
    let landing = 0;
    for (const lead of input.leads) {
        if (lead.createdMs == null || !(0, month_1.isWithinMonth)(lead.createdMs, input.range))
            continue;
        total += 1;
        if ((0, helpers_1.ciEquals)(lead.status, dataContract_1.CLICKUP_STATUS.closedLoss) && (0, helpers_1.ciEquals)(lead.lossReason, 'Not Relevant')) {
            notRelevantLoss += 1;
        }
        if ((0, helpers_1.ciEquals)(lead.source, dataContract_1.CLICKUP_SOURCE.landingPage)) {
            landing += 1;
        }
    }
    const relevant = total - notRelevantLoss;
    const totalLeads = (0, helpers_1.countMetric)('clickup', total, ['Count of Incoming Leads tasks created in month']);
    const relevantLeads = (0, helpers_1.countMetric)('clickup', relevant, ['totalLeads minus Closed Loss with Loss Reason = Not Relevant']);
    const landingVisits = (0, helpers_1.countMetric)('clickup', landing, ['ClickUp proxy: Source = Landing Page']);
    const landingSignups = (0, helpers_1.countMetric)('clickup', landing, ['v1: same as landingVisits (ClickUp is authoritative)']);
    const landingConversionPct = (0, helpers_1.percentMetric)('computed', landing === 0 ? null : (landing / landing) * 100, landing === 0 ? ['visits == 0 => null'] : ['v1: landingSignups equals landingVisits']);
    return { totalLeads, relevantLeads, landingVisits, landingSignups, landingConversionPct };
}
