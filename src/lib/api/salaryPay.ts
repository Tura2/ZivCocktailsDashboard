import { auth, firebaseApp, firebaseEnabled } from '@/lib/firebase';

export type SalaryPayPayload = {
  staffTaskId: string;
  amount: number;
};

export type SalaryPayResult =
  | { ok: true; currentBalance: number; transactionId: string }
  | { ok: false; status: number; message: string; code?: string };

function normalizeUrl(explicit: string | undefined): string | null {
  if (!explicit) return null;
  const trimmed = explicit.trim();
  if (!trimmed) return null;
  const collapsed = trimmed.replace(/^(https?:\/\/)(.*)$/i, (_, scheme: string, rest: string) => {
    return scheme + rest.replace(/\/+?/g, '/');
  });
  return collapsed.replace(/\/+$/g, '');
}

function getSalaryPayUrl(): string | null {
  return normalizeUrl(import.meta.env.VITE_SALARY_PAY_URL as string | undefined);
}

async function post(url: string, token: string, payload: SalaryPayPayload): Promise<{ response: Response; payload: any }> {
  const devEmail = (import.meta.env.VITE_DEV_EMAIL as string | undefined)?.trim();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  if (devEmail) headers['x-dev-email'] = devEmail;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.toLowerCase().includes('application/json');
  const data = isJson ? await response.json().catch(() => ({} as any)) : ({} as any);

  if (!isJson) {
    const text = await response.text().catch(() => '');
    (data as any).__nonJson = { contentType, snippet: text ? text.slice(0, 200) : '' };
  }

  return { response, payload: data };
}

export async function paySalary(payload: SalaryPayPayload): Promise<SalaryPayResult> {
  if (!firebaseEnabled) {
    return { ok: false, status: 0, message: 'Firebase is not configured' };
  }

  const url = getSalaryPayUrl();
  if (!url) {
    return { ok: false, status: 0, message: 'Salary pay endpoint is not configured (missing VITE_SALARY_PAY_URL)' };
  }

  const currentUser = auth?.currentUser;
  if (!currentUser) {
    return { ok: false, status: 401, message: 'Not authenticated' };
  }

  const token1 = await currentUser.getIdToken();
  let { response, payload: resPayload } = await post(url, token1, payload);

  if (!response.ok && response.status === 401 && resPayload?.error?.code === 'invalid_token') {
    if (import.meta.env.DEV) {
      try {
        const tokenResult = await currentUser.getIdTokenResult();
        console.warn('[salaryPay] invalid_token (first attempt)', {
          salaryPayUrl: url,
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
    ({ response, payload: resPayload } = await post(url, token2, payload));
  }

  if (!response.ok) {
    if (resPayload?.__nonJson) {
      return {
        ok: false,
        status: response.status,
        message: `Salary pay failed with non-JSON response (${response.status}). Possible infra/IAM/auth proxy mismatch.`,
        code: 'non_json_response',
      };
    }

    return {
      ok: false,
      status: response.status,
      message: resPayload?.error?.message || `Salary pay failed (${response.status})`,
      code: resPayload?.error?.code,
    };
  }

  return {
    ok: true,
    currentBalance: Number(resPayload?.currentBalance ?? 0),
    transactionId: String(resPayload?.transactionId ?? ''),
  };
}
