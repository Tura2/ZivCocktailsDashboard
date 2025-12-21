import { auth, firebaseEnabled } from '@/lib/firebase';

function getRefreshUrl(): string | null {
  const explicit = import.meta.env.VITE_REFRESH_URL as string | undefined;
  if (explicit && explicit.trim()) return explicit.trim();

  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
  if (!projectId) return null;

  // Matches `functions/src/index.ts` global region.
  const region = 'me-west1';
  return `https://${region}-${projectId}.cloudfunctions.net/refresh`;
}

export type RefreshResult =
  | { ok: true; jobId: string; status: string; targetMonth?: string; writtenSnapshots?: string[]; skippedSnapshots?: string[] }
  | { ok: false; status: number; message: string; code?: string };

export async function triggerRefresh(targetMonth?: string): Promise<RefreshResult> {
  if (!firebaseEnabled) {
    return { ok: false, status: 0, message: 'Firebase is not configured' };
  }

  const url = getRefreshUrl();
  if (!url) {
    return { ok: false, status: 0, message: 'Refresh endpoint is not configured (missing VITE_REFRESH_URL or VITE_FIREBASE_PROJECT_ID)' };
  }

  const currentUser = auth?.currentUser;
  if (!currentUser) {
    return { ok: false, status: 401, message: 'Not authenticated' };
  }

  const token = await currentUser.getIdToken(true);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(targetMonth ? { targetMonth } : {}),
  });

  const payload = await response
    .json()
    .catch(() => ({} as any));

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      message: payload?.error?.message || `Refresh failed (${response.status})`,
      code: payload?.error?.code,
    };
  }

  return {
    ok: true,
    jobId: payload?.jobId,
    status: payload?.status ?? 'success',
    targetMonth: payload?.targetMonth,
    writtenSnapshots: payload?.writtenSnapshots,
    skippedSnapshots: payload?.skippedSnapshots,
  };
}
