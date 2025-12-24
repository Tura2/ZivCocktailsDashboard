import { useEffect, useMemo, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, type QueryConstraint } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import type { SnapshotDoc } from '@/lib/snapshots/types';

type State =
  | { status: 'disabled' }
  | { status: 'loading' }
  | { status: 'ready'; data: SnapshotDoc[] }
  | { status: 'error'; error: string };

export function useSnapshots(options?: { limit?: number }) {
  const max = options?.limit ?? 60;
  const [state, setState] = useState<State>(() => (firestore ? { status: 'loading' } : { status: 'disabled' }));

  useEffect(() => {
    if (!firestore) {
      setState({ status: 'disabled' });
      return;
    }

    setState({ status: 'loading' });

    const constraints: QueryConstraint[] = [orderBy('month', 'desc'), limit(max)];
    const ref = query(collection(firestore, 'snapshots'), ...constraints);

    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        const docs: SnapshotDoc[] = [];
        snap.forEach((d) => {
          docs.push(d.data() as SnapshotDoc);
        });
        setState({ status: 'ready', data: docs });
      },
      (err) => {
        setState({ status: 'error', error: err.message || 'Failed to load snapshots' });
      },
    );

    return () => unsubscribe();
  }, [max]);

  const monthsDesc = useMemo(() => {
    if (state.status !== 'ready') return [] as string[];
    return state.data.map((d) => d.month);
  }, [state]);

  return { state, monthsDesc };
}
