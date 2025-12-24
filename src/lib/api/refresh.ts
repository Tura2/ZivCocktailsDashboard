import { auth, firebaseApp, firebaseEnabled } from '@/lib/firebase';

function getRefreshUrl(): string | null {
  const explicit = import.meta.env.VITE_REFRESH_URL as string | undefined;
  if (explicit && explicit.trim()) {
    // Normalize to avoid accidental trailing slashes and double slashes from env files.
    // DevTools may still display a trailing '/', but the request URL will be stable.
    const trimmed = explicit.trim();
    // Collapse repeated slashes after the scheme (keep "https://").
    const collapsed = trimmed.replace(/^(https?:\/\/)(.*)$/i, (_, scheme: string, rest: string) => {
      return scheme + rest.replace(/\/+/g, '/');
    });
    return collapsed.replace(/\/+$/g, '');
  }

  // Intentionally require explicit configuration.
  // Cloud Functions / Cloud Run URLs vary by environment and should be provided via env.
  return null;
}

export type RefreshResult =
  | { ok: true; jobId: string; status: string; targetMonth?: string; writtenSnapshots?: string[]; skippedSnapshots?: string[] }
  | { ok: false; status: number; message: string; code?: string };

async function postRefresh(url: string, token: string, targetMonth?: string): Promise<{ response: Response; payload: any }> {
  const devEmail = (import.meta.env.VITE_DEV_EMAIL as string | undefined)?.trim();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  if (devEmail) {
    headers['x-dev-email'] = devEmail;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(targetMonth ? { targetMonth } : {}),
  });

  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.toLowerCase().includes('application/json');
  const payload = isJson ? await response.json().catch(() => ({} as any)) : ({} as any);

  // If we didn't get JSON back, capture a small text snippet to distinguish infra errors.
  if (!isJson) {
    const text = await response.text().catch(() => '');
    (payload as any).__nonJson = {
      contentType,
      snippet: text ? text.slice(0, 200) : '',
    };
  }
  return { response, payload };
}

export async function triggerRefresh(targetMonth?: string): Promise<RefreshResult> {
  if (!firebaseEnabled) {
    return { ok: false, status: 0, message: 'Firebase is not configured' };
  }

  const url = getRefreshUrl();
  if (!url) {
    return { ok: false, status: 0, message: 'Refresh endpoint is not configured (missing VITE_REFRESH_URL)' };
  }

  const currentUser = auth?.currentUser;
  if (!currentUser) {
    return { ok: false, status: 401, message: 'Not authenticated' };
  }

  // Use cached token first, then retry once with a forced refresh on invalid_token.
  const token1 = await currentUser.getIdToken();
  let { response, payload } = await postRefresh(url, token1, targetMonth);

  if (!response.ok && response.status === 401 && payload?.error?.code === 'invalid_token') {
    if (import.meta.env.DEV) {
      try {
        const tokenResult = await currentUser.getIdTokenResult();
        // Intentionally do not log the token itself.
        console.warn('[refresh] invalid_token (first attempt)', {
          refreshUrl: url,
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
    ({ response, payload } = await postRefresh(url, token2, targetMonth));
  }

  if (!response.ok) {
    if (payload?.__nonJson) {
      return {
        ok: false,
        status: response.status,
        message: `Refresh failed with non-JSON response (${response.status}). Possible infra/IAM/auth proxy mismatch.`,
        code: 'non_json_response',
      };
    }
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
