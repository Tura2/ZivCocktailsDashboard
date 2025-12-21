import { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import type { DashboardLatestDoc } from '@/lib/dashboard/types';

type State =
  | { status: 'disabled' }
  | { status: 'loading' }
  | { status: 'ready'; data: DashboardLatestDoc | null }
  | { status: 'error'; error: string };

export function useDashboardLatest() {
  const [state, setState] = useState<State>(() => (firestore ? { status: 'loading' } : { status: 'disabled' }));

  useEffect(() => {
    if (!firestore) {
      setState({ status: 'disabled' });
      return;
    }

    setState({ status: 'loading' });

    const ref = doc(firestore, 'dashboard', 'latest');
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setState({ status: 'ready', data: null });
          return;
        }
        setState({ status: 'ready', data: snap.data() as DashboardLatestDoc });
      },
      (err) => {
        setState({ status: 'error', error: err.message || 'Failed to load dashboard/latest' });
      },
    );

    return () => unsubscribe();
  }, []);

  const lastUpdatedIso = useMemo(() => {
    if (state.status !== 'ready' || !state.data) return null;
    return state.data.computedAt || state.data.metrics?.computedAt || null;
  }, [state]);

  return { state, lastUpdatedIso };
}
