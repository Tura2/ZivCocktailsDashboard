import { auth, firebaseApp, firebaseEnabled } from '@/lib/firebase';

export type SyncId = 'income' | 'expenses';

export type SyncResult =
  | { ok: true; syncId: SyncId; resultText: string }
  | { ok: false; status: number; message: string; code?: string };

function normalizeUrl(explicit: string | undefined): string | null {
  if (!explicit) return null;
  const trimmed = explicit.trim();
  if (!trimmed) return null;
  // Collapse repeated slashes after the scheme (keep "https://").
  const collapsed = trimmed.replace(/^(https?:\/\/)(.*)$/i, (_, scheme: string, rest: string) => {
    return scheme + rest.replace(/\/+?/g, '/');
  });
  return collapsed.replace(/\/+$/g, '');
}

function getSyncUrl(syncId: SyncId): string | null {
  if (syncId === 'income') return normalizeUrl(import.meta.env.VITE_SYNC_INCOME_URL as string | undefined);
  return normalizeUrl(import.meta.env.VITE_SYNC_EXPENSES_URL as string | undefined);
}

async function postSync(url: string, token: string): Promise<{ response: Response; payload: any }> {
  const devEmail = (import.meta.env.VITE_DEV_EMAIL as string | undefined)?.trim();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  if (devEmail) headers['x-dev-email'] = devEmail;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });

  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.toLowerCase().includes('application/json');
  const payload = isJson ? await response.json().catch(() => ({} as any)) : ({} as any);

  if (!isJson) {
    const text = await response.text().catch(() => '');
    (payload as any).__nonJson = {
      contentType,
      snippet: text ? text.slice(0, 200) : '',
    };
  }

  return { response, payload };
}

async function triggerSync(syncId: SyncId): Promise<SyncResult> {
  if (!firebaseEnabled) {
    return { ok: false, status: 0, message: 'Firebase is not configured' };
  }

  const url = getSyncUrl(syncId);
  if (!url) {
    const envName = syncId === 'income' ? 'VITE_SYNC_INCOME_URL' : 'VITE_SYNC_EXPENSES_URL';
    return { ok: false, status: 0, message: `Sync endpoint is not configured (missing ${envName})` };
  }

  const currentUser = auth?.currentUser;
  if (!currentUser) {
    return { ok: false, status: 401, message: 'Not authenticated' };
  }

  // Use cached token first, then retry once with a forced refresh on invalid_token.
  const token1 = await currentUser.getIdToken();
  let { response, payload } = await postSync(url, token1);

  if (!response.ok && response.status === 401 && payload?.error?.code === 'invalid_token') {
    if (import.meta.env.DEV) {
      try {
        const tokenResult = await currentUser.getIdTokenResult();
        // Intentionally do not log the token itself.
        console.warn('[sync] invalid_token (first attempt)', {
          syncId,
          url,
          firebaseProjectId: firebaseApp?.options?.projectId,
          aud: (tokenResult?.claims as any)?.aud,
          iss: (tokenResult?.claims as any)?.iss,
          exp: (tokenResult?.claims as any)?.exp,
          iat: (tokenResult?.claims as any)?.iat,
        });
      } catch {
        // ignore
      }
    }

    const token2 = await currentUser.getIdToken(true);
    ({ response, payload } = await postSync(url, token2));
  }

  if (!response.ok) {
    if (payload?.__nonJson) {
      return {
        ok: false,
        status: response.status,
        message: `Sync failed with non-JSON response (${response.status}). Possible infra/IAM/auth proxy mismatch.`,
        code: 'non_json_response',
      };
    }

    return {
      ok: false,
      status: response.status,
      message: payload?.error?.message || `Sync failed (${response.status})`,
      code: payload?.error?.code,
    };
  }

  const result = payload?.result;
  if (syncId === 'income') {
    const synced = Number(result?.synced ?? 0) || 0;
    const skipped = Number(result?.skippedDoctype ?? 0) || 0;
    return { ok: true, syncId, resultText: `synced ${synced}, skipped ${skipped}` };
  }

  const synced = Number(result?.synced ?? 0) || 0;
  const unknown = Array.isArray(result?.unknownCategories) ? result.unknownCategories.length : 0;
  return { ok: true, syncId, resultText: `synced ${synced}, unknown categories ${unknown}` };
}

export function triggerSyncIncome(): Promise<SyncResult> {
  return triggerSync('income');
}

export function triggerSyncExpenses(): Promise<SyncResult> {
  return triggerSync('expenses');
}
