import type { InstagramClient } from './InstagramClient';

interface GraphInsightsResponse {
  data?: Array<{
    name?: string;
    period?: string;
    values?: Array<{ value?: number; end_time?: string }>;
  }>;
}

function toUrl(base: string, params: Record<string, string | number | undefined>): string {
  const url = new URL(base);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    url.searchParams.set(k, String(v));
  }
  return url.toString();
}

export interface InstagramGraphClientOptions {
  accessToken: string;
  igUserId: string;
  apiVersion?: string;
}

export class InstagramGraphClient implements InstagramClient {
  private readonly accessToken: string;
  private readonly igUserId: string;
  private readonly apiVersion: string;

  constructor(options: InstagramGraphClientOptions) {
    this.accessToken = options.accessToken;
    this.igUserId = options.igUserId;
    this.apiVersion = options.apiVersion ?? 'v19.0';
  }

  async getFollowerCountSeries(options: { sinceMs: number; untilMs: number }): Promise<Array<{ endTimeIso: string; value: number }>> {
    // Instagram Graph expects seconds
    const since = Math.floor(options.sinceMs / 1000);
    const until = Math.floor(options.untilMs / 1000);

    const url = toUrl(`https://graph.facebook.com/${this.apiVersion}/${this.igUserId}/insights`, {
      metric: 'follower_count',
      period: 'day',
      since,
      until,
      access_token: this.accessToken,
    });

    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Instagram Graph request failed (${res.status}) ${res.statusText}. ${body}`);
    }

    const json = (await res.json()) as GraphInsightsResponse;
    const metric = json.data?.find((d) => d.name === 'follower_count');
    const values = metric?.values ?? [];

    return values
      .filter((v) => typeof v.value === 'number' && typeof v.end_time === 'string')
      .map((v) => ({ value: v.value as number, endTimeIso: v.end_time as string }));
  }
}
