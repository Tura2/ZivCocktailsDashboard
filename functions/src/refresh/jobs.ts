import { admin, getDb } from './firebaseAdmin';

export type JobStatus = 'running' | 'success' | 'error';

export interface JobDoc {
  type: 'refresh';
  status: JobStatus;
  startedAt: FirebaseFirestore.FieldValue;
  finishedAt?: FirebaseFirestore.FieldValue;
  requestedByEmail: string;
  targetMonth: string;
  writtenSnapshots: string[];
  skippedSnapshots: string[];
  logs: string[];
  error?: { message: string; code?: string };
}

const MAX_LOG_LINES = 80;
const MAX_LINE_LEN = 240;

function clampLine(s: string): string {
  const oneLine = s.replace(/\s+/g, ' ').trim();
  return oneLine.length > MAX_LINE_LEN ? oneLine.slice(0, MAX_LINE_LEN - 3) + '...' : oneLine;
}

export function newJobId(): string {
  // Firestore push-id style not needed; random is OK.
  return getDb().collection('jobs').doc().id;
}

export async function createJob(jobId: string, requestedByEmail: string, targetMonth: string): Promise<void> {
  const ref = getDb().collection('jobs').doc(jobId);

  const doc: JobDoc = {
    type: 'refresh',
    status: 'running',
    startedAt: admin.firestore.FieldValue.serverTimestamp(),
    requestedByEmail,
    targetMonth,
    writtenSnapshots: [],
    skippedSnapshots: [],
    logs: [],
  };

  await ref.set(doc, { merge: false });
}

export async function appendJobLog(jobId: string, message: string): Promise<void> {
  const ref = getDb().collection('jobs').doc(jobId);
  const entry = clampLine(message);

  await getDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const logs = (snap.data()?.logs ?? []) as unknown;
    const arr = Array.isArray(logs) ? logs.filter((l) => typeof l === 'string') : [];
    arr.push(entry);

    const trimmed = arr.slice(Math.max(0, arr.length - MAX_LOG_LINES));
    tx.update(ref, { logs: trimmed });
  });
}

export async function markJobSuccess(jobId: string, writtenSnapshots: string[], skippedSnapshots: string[]): Promise<void> {
  const ref = getDb().collection('jobs').doc(jobId);
  await ref.update({
    status: 'success',
    finishedAt: admin.firestore.FieldValue.serverTimestamp(),
    writtenSnapshots,
    skippedSnapshots,
  });
}

export async function markJobError(jobId: string, message: string, code?: string): Promise<void> {
  const ref = getDb().collection('jobs').doc(jobId);
  const error: { message: string; code?: string } = code ? { message, code } : { message };
  await ref.update({
    status: 'error',
    finishedAt: admin.firestore.FieldValue.serverTimestamp(),
    error,
  });
}

export async function pruneOldJobs(keepLatest = 10): Promise<number> {
  if (!Number.isFinite(keepLatest) || keepLatest < 1) {
    throw new Error('keepLatest must be a positive number');
  }

  const col = getDb().collection('jobs');

  const keepSnap = await col.orderBy('startedAt', 'desc').limit(keepLatest).get();
  const lastKept = keepSnap.docs[keepSnap.docs.length - 1];
  if (!lastKept) return 0;

  let deleted = 0;

  // Delete in pages to keep batches small and avoid long runtime.
  while (true) {
    const oldSnap = await col.orderBy('startedAt', 'desc').startAfter(lastKept).limit(200).get();
    if (oldSnap.empty) break;

    const batch = getDb().batch();
    for (const doc of oldSnap.docs) {
      batch.delete(doc.ref);
      deleted += 1;
    }
    await batch.commit();
  }

  return deleted;
}
