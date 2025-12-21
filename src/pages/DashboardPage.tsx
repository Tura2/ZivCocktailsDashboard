import { useMemo, useState } from 'react';
import Card from '@/components/dashboard/Card';
import KpiGrid from '@/components/dashboard/KpiGrid';
import { firebaseEnabled } from '@/lib/firebase';
import { useDashboardLatest } from '@/lib/dashboard/useDashboardLatest';
import type { DashboardMetrics } from '@/lib/dashboard/types';
import { triggerRefresh } from '@/lib/api/refresh';

function formatILS(value: number | null | undefined) {
  if (value == null) return '—';
  try {
    return new Intl.NumberFormat('en-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${value} ₪`;
  }
}

function formatNumber(value: number | null | undefined) {
  if (value == null) return '—';
  return new Intl.NumberFormat().format(value);
}

function formatPercent(value: number | null | undefined) {
  if (value == null) return '—';
  return `${value}%`;
}

function formatLastUpdated(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function MiniBarChart({ labels, values }: { labels: string[]; values: Array<number | null | undefined> }) {
  const numbers = values.map((v) => (v == null ? 0 : v));
  const max = Math.max(...numbers, 1);

  return (
    <div className="mt-4 grid gap-3">
      {labels.map((label, idx) => {
        const raw = values[idx];
        const v = raw == null ? 0 : raw;
        const widthPct = Math.max(2, Math.round((v / max) * 100));
        return (
          <div key={label} className="grid grid-cols-[140px,1fr,110px] items-center gap-3">
            <div className="text-sm text-slate-600">{label}</div>
            <div className="h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${widthPct}%` }} />
            </div>
            <div className="text-right text-sm font-medium text-slate-900">{formatILS(raw as number | null)}</div>
          </div>
        );
      })}
    </div>
  );
}

function MiniLineChart({ points, labels }: { points: Array<number | null | undefined>; labels: string[] }) {
  const values = points.map((v) => (v == null ? 0 : v));
  const max = Math.max(...values, 1);
  const width = 320;
  const height = 120;

  const polyline = values
    .map((v, idx) => {
      const x = (idx / Math.max(values.length - 1, 1)) * width;
      const y = height - (v / max) * height;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="mt-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-28 w-full" aria-hidden>
          <polyline fill="none" stroke="currentColor" className="text-indigo-600" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" points={polyline} />
        </svg>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {labels.map((l, idx) => (
            <div key={l} className="rounded-md bg-white px-3 py-2 text-sm">
              <div className="text-xs text-slate-500">{l}</div>
              <div className="mt-1 font-medium text-slate-900">{formatNumber(points[idx] as number | null)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CategorySection({ title, items }: { title: string; items: Parameters<typeof KpiGrid>[0]['items'] }) {
  return (
    <section className="mt-6">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">{title}</h2>
      </div>
      <KpiGrid items={items} />
    </section>
  );
}

function buildKpis(metrics: DashboardMetrics) {
  return {
    financial: [
      { key: 'monthlyRevenue', label: 'Monthly revenue (gross)', value: formatILS(metrics.financial.monthlyRevenue.grossILS) },
      { key: 'expectedCashflow', label: 'Expected cashflow (gross)', value: formatILS(metrics.financial.expectedCashflow.grossILS) },
      { key: 'expectedExpenses', label: 'Expected expenses (gross)', value: formatILS(metrics.financial.expectedExpenses.grossILS) },
      { key: 'monthlyRevenueNet', label: 'Monthly revenue (net)', value: formatILS(metrics.financial.monthlyRevenue.netILS) },
    ],
    marketing: [
      { key: 'totalLeads', label: 'Total leads', value: formatNumber(metrics.marketing.totalLeads.value) },
      { key: 'relevantLeads', label: 'Relevant leads', value: formatNumber(metrics.marketing.relevantLeads.value) },
      { key: 'landingVisits', label: 'Landing visits', value: formatNumber(metrics.marketing.landingVisits.value) },
      { key: 'landingConversionPct', label: 'Landing conversion', value: formatPercent(metrics.marketing.landingConversionPct.value) },
      { key: 'followersDeltaMonth', label: 'Followers Δ (month)', value: formatNumber(metrics.marketing.followersDeltaMonth.value) },
      { key: 'followersEndOfMonth', label: 'Followers (EOM)', value: formatNumber(metrics.marketing.followersEndOfMonth.value) },
    ],
    sales: [
      { key: 'avgRevenuePerDeal', label: 'Avg revenue / deal (gross)', value: formatILS(metrics.sales.avgRevenuePerDeal.grossILS) },
      { key: 'salesCalls', label: 'Sales calls', value: formatNumber(metrics.sales.salesCalls.value) },
      { key: 'closures', label: 'Closures', value: formatNumber(metrics.sales.closures.value) },
      { key: 'closeRatePct', label: 'Close rate', value: formatPercent(metrics.sales.closeRatePct.value) },
    ],
    operations: [
      { key: 'activeCustomers', label: 'Active customers', value: formatNumber(metrics.operations.activeCustomers.value) },
      { key: 'cancellations', label: 'Cancellations', value: formatNumber(metrics.operations.cancellations.value) },
      { key: 'referralsWordOfMouth', label: 'Referrals (WoM)', value: formatNumber(metrics.operations.referralsWordOfMouth.value) },
      { key: 'returningCustomers', label: 'Returning customers', value: formatNumber(metrics.operations.returningCustomers.value) },
    ],
  };
}

export function DashboardPage() {
  const { state, lastUpdatedIso } = useDashboardLatest();
  const [refreshState, setRefreshState] = useState<{ status: 'idle' | 'running' | 'ok' | 'error'; message?: string }>(
    () => ({ status: 'idle' }),
  );

  const latest = state.status === 'ready' ? state.data : null;
  const metrics = latest?.metrics ?? null;

  const kpis = useMemo(() => (metrics ? buildKpis(metrics) : null), [metrics]);

  const onRefresh = async () => {
    setRefreshState({ status: 'running' });
    try {
      const result = await triggerRefresh();
      if (!result.ok) {
        setRefreshState({ status: 'error', message: result.code ? `${result.message} (${result.code})` : result.message });
        return;
      }
      setRefreshState({ status: 'ok', message: `Refresh started (job ${result.jobId})` });
    } catch (e) {
      const err = e as Error;
      setRefreshState({ status: 'error', message: err.message || 'Refresh failed' });
    }
  };

  if (!firebaseEnabled) {
    return (
      <Card>
        <h1 className="text-lg font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-2 text-sm text-slate-600">Firebase is not configured. Add `VITE_*` env vars to enable Firestore reads.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">
            Last updated: <span className="font-medium text-slate-900">{formatLastUpdated(lastUpdatedIso)}</span>
            {latest?.month ? <span className="ml-2 text-slate-400">·</span> : null}
            {latest?.month ? <span className="ml-2 text-slate-600">Month: {latest.month}</span> : null}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {refreshState.status === 'error' ? <span className="text-sm text-red-600">{refreshState.message}</span> : null}
          {refreshState.status === 'ok' ? <span className="text-sm text-green-700">{refreshState.message}</span> : null}
          <button
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 disabled:opacity-60"
            onClick={onRefresh}
            disabled={refreshState.status === 'running' || state.status === 'disabled'}
          >
            {refreshState.status === 'running' ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {state.status === 'loading' ? (
        <Card>
          <p className="text-sm text-slate-600">Loading `dashboard/latest`…</p>
        </Card>
      ) : null}

      {state.status === 'error' ? (
        <Card>
          <p className="text-sm text-red-600">{state.error}</p>
        </Card>
      ) : null}

      {state.status === 'ready' && !latest ? (
        <Card>
          <p className="text-sm text-slate-600">No data found at `dashboard/latest`. Click Refresh to generate the latest dashboard.</p>
        </Card>
      ) : null}

      {metrics && kpis ? (
        <>
          <CategorySection title="Financial" items={kpis.financial} />
          <CategorySection title="Marketing" items={kpis.marketing} />
          <CategorySection title="Sales" items={kpis.sales} />
          <CategorySection title="Operations" items={kpis.operations} />

          <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <h3 className="text-lg font-semibold text-slate-900">Financial snapshot (gross ILS)</h3>
              <p className="mt-1 text-sm text-slate-500">Bars reflect values from `dashboard/latest.metrics.financial`.</p>
              <MiniBarChart
                labels={['Monthly revenue', 'Expected cashflow', 'Expected expenses']}
                values={[metrics.financial.monthlyRevenue.grossILS, metrics.financial.expectedCashflow.grossILS, metrics.financial.expectedExpenses.grossILS]}
              />
            </Card>

            <Card>
              <h3 className="text-lg font-semibold text-slate-900">Lead → close funnel (counts)</h3>
              <p className="mt-1 text-sm text-slate-500">Line reflects a funnel using values from `dashboard/latest.metrics`.</p>
              <MiniLineChart
                labels={['Total leads', 'Relevant leads', 'Sales calls', 'Closures']}
                points={[metrics.marketing.totalLeads.value, metrics.marketing.relevantLeads.value, metrics.sales.salesCalls.value, metrics.sales.closures.value]}
              />
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}


