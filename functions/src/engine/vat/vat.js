"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VAT_RATE = void 0;
exports.grossToNet = grossToNet;
exports.netToGross = netToGross;
exports.ensureNetGross = ensureNetGross;
exports.VAT_RATE = 0.18;
function grossToNet(grossILS) {
    return grossILS / (1 + exports.VAT_RATE);
}
function netToGross(netILS) {
    return netILS * (1 + exports.VAT_RATE);
}
function ensureNetGross(amount) {
    const notes = [];
    const gross = amount.grossILS ?? null;
    const net = amount.netILS ?? null;
    if (gross == null && net == null) {
        return { grossILS: null, netILS: null, notes: ['No amount available'] };
    }
    if (gross != null && net != null) {
        return { grossILS: gross, netILS: net, notes };
    }
    if (gross != null) {
        notes.push('Net computed from gross using VAT 18%');
        return { grossILS: gross, netILS: grossToNet(gross), notes };
    }
    notes.push('Gross computed from net using VAT 18%');
    return { grossILS: netToGross(net), netILS: net, notes };
}
