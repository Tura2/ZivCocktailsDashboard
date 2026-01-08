/**
 * Calculation breakdown types for dashboard metrics.
 *
 * Firestore source of truth:
 * snapshots/{snapshotId}/metricBreakdowns/{metricKey}
 *
 * Notes:
 * - Amounts are stored as integers in agorot (ILS cents) to avoid float issues.
 * - "none" indicates there is intentionally no breakdown ("as-is" metrics).
 */

export type MetricBreakdownKind = 'none' | 'names' | 'line_items';

export type MetricKey = string;

export type MetricBreakdownBase = {
  schemaVersion: 1;
  metricKey: MetricKey;
  kind: MetricBreakdownKind;
  generatedAt?: string; // ISO
};

export type MetricBreakdownNone = MetricBreakdownBase & {
  kind: 'none';
};

export type MetricBreakdownNames = MetricBreakdownBase & {
  kind: 'names';
  items: Array<{
    id?: string;
    name: string;
    status?: string | null;
    dateIso?: string; // ISO (can be date-only)
  }>;
};

export type MetricBreakdownLineItems = MetricBreakdownBase & {
  kind: 'line_items';
  currency: 'ILS';
  items: Array<{
    id?: string;
    name: string;
    amountAgorot: number;
    status?: string | null;
    dateIso?: string; // ISO (optional)
  }>;
};

export type MetricBreakdown = MetricBreakdownNone | MetricBreakdownNames | MetricBreakdownLineItems;
