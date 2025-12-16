export const VAT_RATE = 0.18;

export function grossToNet(grossILS: number): number {
  return grossILS / (1 + VAT_RATE);
}

export function netToGross(netILS: number): number {
  return netILS * (1 + VAT_RATE);
}

export function ensureNetGross(amount: {
  grossILS?: number | null;
  netILS?: number | null;
}): { grossILS: number | null; netILS: number | null; notes: string[] } {
  const notes: string[] = [];

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
  return { grossILS: netToGross(net as number), netILS: net as number, notes };
}
