import { getDb } from './firebaseAdmin';
import { AlreadyRunningError } from './errors';

export interface RefreshLockState {
  jobId: string;
  lockedAtMs: number;
  expiresAtMs: number;
}

const LOCK_DOC = 'jobs_lock/refresh';

// TTL prevents a crash from bricking refresh forever.
export async function acquireRefreshLock(jobId: string, ttlMs = 20 * 60 * 1000): Promise<void> {
  const db = getDb();
  const ref = db.doc(LOCK_DOC);

  const nowMs = Date.now();
  const newState: RefreshLockState = {
    jobId,
    lockedAtMs: nowMs,
    expiresAtMs: nowMs + ttlMs,
  };

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? (snap.data() as Partial<RefreshLockState>) : null;

    if (data?.expiresAtMs && typeof data.expiresAtMs === 'number' && data.expiresAtMs > nowMs) {
      throw new AlreadyRunningError(String(data.jobId ?? 'unknown'));
    }

    tx.set(ref, newState, { merge: false });
  });
}

export async function releaseRefreshLock(jobId: string): Promise<void> {
  const db = getDb();
  const ref = db.doc(LOCK_DOC);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const data = snap.data() as Partial<RefreshLockState>;

    if (String(data.jobId ?? '') !== jobId) {
      // Don't clobber a newer lock.
      return;
    }

    tx.delete(ref);
  });
}
