import type { CountMetric, CurrencyMetric, MetricMeta, PercentMetric } from '../dashboard/types';

export function meta(source: MetricMeta['source'], notes?: string[]): MetricMeta {
  return { source, notes: notes && notes.length ? notes : undefined };
}

export function currencyMetric(
  source: MetricMeta['source'],
  value: { grossILS: number | null; netILS: number | null },
  notes?: string[],
): CurrencyMetric {
  return {
    grossILS: value.grossILS,
    netILS: value.netILS,
    meta: meta(source, notes),
  };
}

export function countMetric(source: MetricMeta['source'], value: number | null, notes?: string[]): CountMetric {
  return { value, meta: meta(source, notes) };
}

export function percentMetric(source: MetricMeta['source'], value: number | null, notes?: string[]): PercentMetric {
  return { value, meta: meta(source, notes) };
}

export function ciEquals(a: string | null | undefined, b: string): boolean {
  if (a == null) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
