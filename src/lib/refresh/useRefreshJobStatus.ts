import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';

import { firestore } from '@/lib/firebase';
import { getRefreshJobId, setRefreshJobId, subscribeRefreshJobId } from './refreshRuntime';

type JobStatus = 'running' | 'success' | 'error';

type RefreshJobState =
  | { status: 'disabled' }
  | { status: 'idle' }
  | { status: 'running'; jobId: string }
  | { status: 'done'; jobId: string; result: Exclude<JobStatus, 'running'> };

export function useRefreshJobStatus(): RefreshJobState {
  const [jobId, setJobId] = useState<string | null>(() => getRefreshJobId());
  const [state, setState] = useState<RefreshJobState>(() => {
    if (!firestore) return { status: 'disabled' };
    return jobId ? { status: 'running', jobId } : { status: 'idle' };
  });

  useEffect(() => subscribeRefreshJobId(setJobId), []);

  useEffect(() => {
    if (!firestore) {
      setState({ status: 'disabled' });
      return;
    }

    if (!jobId) {
      setState({ status: 'idle' });
      return;
    }

    const ref = doc(firestore, 'jobs', jobId);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setRefreshJobId(null);
          setState({ status: 'idle' });
          return;
        }

        const statusRaw = String((snap.data() as any)?.status ?? '').toLowerCase();
        const status = (statusRaw === 'running' || statusRaw === 'success' || statusRaw === 'error') ? (statusRaw as JobStatus) : null;

        if (status === 'running') {
          setState({ status: 'running', jobId });
          return;
        }

        if (status === 'success' || status === 'error') {
          setState({ status: 'done', jobId, result: status });
          setRefreshJobId(null);
          return;
        }

        // Unknown state: be conservative and stop blocking the UI.
        setState({ status: 'idle' });
        setRefreshJobId(null);
      },
      () => {
        // If we can't read the job doc, don't block the UI forever.
        setState({ status: 'idle' });
        setRefreshJobId(null);
      },
    );

    return () => unsub();
  }, [jobId]);

  return state;
}
