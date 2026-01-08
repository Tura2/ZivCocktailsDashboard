import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';

import { firestore } from '@/lib/firebase';
import type { MetricBreakdown, MetricKey } from '@/types/metrics';

export type MetricBreakdownState =
  | { status: 'disabled' }
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; data: MetricBreakdown }
  | { status: 'missing' }
  | { status: 'error'; error: string };

type CacheKey = `${string}::${string}::${string}`;

// Cache only successful breakdown loads. Missing docs are not cached so
// a later refresh can start producing breakdowns without requiring a restart.
const breakdownCache = new Map<CacheKey, MetricBreakdown>();

function resolveBreakdownDocKey(metricKey: MetricKey): string {
  // Some pages use display-oriented keys (e.g. *Gross suffix) while Firestore
  // breakdown docs are stored under canonical IDs.
  switch (metricKey) {
    case 'avgRevenuePerDeal':
      return 'avgRevenuePerDealGross';
    case 'monthlyRevenueGross':
      return 'monthlyRevenue';
    case 'expectedCashflowGross':
      return 'expectedCashflow';
    case 'expectedExpensesGross':
      return 'expectedExpenses';
    default:
      return metricKey;
  }
}

function cacheKey(snapshotId: string, metricKey: string, cacheBuster: string | null | undefined): CacheKey {
  return `${snapshotId}::${metricKey}::${cacheBuster ?? ''}`;
}

/**
 * Lazily loads a metric breakdown doc from Firestore.
 *
 * Fetching is ONLY triggered by calling `trigger()`.
 *
 * Path:
 * snapshots/{snapshotId}/metricBreakdowns/{metricKey}
 */
export function useMetricBreakdown(
  snapshotId: string | null | undefined,
  metricKey: MetricKey | null | undefined,
  cacheBuster?: string | null,
) {
  const [requested, setRequested] = useState(false);
  const [state, setState] = useState<MetricBreakdownState>(() => {
    if (!firestore) return { status: 'disabled' };
    return { status: 'idle' };
  });

  const activeRequest = useRef(0);

  const docKey = useMemo(() => (metricKey ? resolveBreakdownDocKey(metricKey) : null), [metricKey]);

  const trigger = useCallback(() => {
    if (!firestore) {
      setState({ status: 'disabled' });
      return;
    }
    if (!snapshotId || !metricKey || !docKey) return;

    const key = cacheKey(snapshotId, docKey, cacheBuster);
    if (breakdownCache.has(key)) {
      const cached = breakdownCache.get(key) as MetricBreakdown;
      setState({ status: 'ready', data: cached });
      return;
    }

    setRequested(true);
  }, [cacheBuster, docKey, metricKey, snapshotId]);

  useEffect(() => {
    if (!firestore) {
      setState({ status: 'disabled' });
      return;
    }
    const fs = firestore;
    if (!requested) return;
    if (!snapshotId || !metricKey || !docKey) return;

    const run = async () => {
      const reqId = ++activeRequest.current;
      setState((prev) => (prev.status === 'ready' ? prev : { status: 'loading' }));

      try {
        const ref = doc(fs, 'snapshots', snapshotId, 'metricBreakdowns', docKey);
        const snap = await getDoc(ref);

        if (reqId !== activeRequest.current) return;

        if (!snap.exists()) {
          setState({ status: 'missing' });
          return;
        }

        const data = snap.data() as MetricBreakdown;

        if (!data || data.kind === 'none') {
          setState({ status: 'missing' });
          return;
        }

  breakdownCache.set(cacheKey(snapshotId, docKey, cacheBuster), data);

        setState({ status: 'ready', data });
      } catch (e) {
        if (reqId !== activeRequest.current) return;
        const err = e as Error;
        setState({ status: 'error', error: err.message || 'Failed to load breakdown' });
      }
    };

    void run();
  }, [cacheBuster, docKey, metricKey, requested, snapshotId]);

  const breakdown = useMemo(() => (state.status === 'ready' ? state.data : null), [state]);

  return {
    state,
    breakdown,
    trigger,
  };
}
