import { useMemo, useState } from 'react';
import Card from '@/components/dashboard/Card';
import KpiGrid from '@/components/dashboard/KpiGrid';
import { firebaseEnabled } from '@/lib/firebase';
import { useDashboardLatest } from '@/lib/dashboard/useDashboardLatest';
import type { DashboardMetrics } from '@/lib/dashboard/types';
import { triggerRefresh } from '@/lib/api/refresh';
import { Toolbar } from '@/components/ui/Toolbar';
import { SectionCard } from '@/components/ui/SectionCard';
import { KpiTile } from '@/components/ui/KpiTile';
import type { DensityMode } from '@/ui/density';
import { densityGaps } from '@/ui/density';

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

function formatPercent2Trunc(value: number | null | undefined) {
  if (value == null) return '—';
  const truncated = Math.trunc(value * 100) / 100;
  return `${truncated.toFixed(2)}%`;
}

function formatLastUpdated(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
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

function buildKpis(metrics: DashboardMetrics) {
  return {
    financial: [
      { key: 'monthlyRevenue', label: 'Monthly revenue (gross)', value: formatILS(metrics.financial.monthlyRevenue.grossILS), category: 'financial' as const },
      { key: 'expectedCashflow', label: 'Expected cashflow (gross)', value: formatILS(metrics.financial.expectedCashflow.grossILS), category: 'financial' as const },
      { key: 'expectedExpenses', label: 'Expected expenses (gross)', value: formatILS(metrics.financial.expectedExpenses.grossILS), category: 'financial' as const },
      { key: 'monthlyRevenueNet', label: 'Monthly revenue (net)', value: formatILS(metrics.financial.monthlyRevenue.netILS), category: 'financial' as const },
    ],
    marketing: [
      { key: 'totalLeads', label: 'Total leads', value: formatNumber(metrics.marketing.totalLeads.value), category: 'marketing' as const },
      { key: 'relevantLeads', label: 'Relevant leads', value: formatNumber(metrics.marketing.relevantLeads.value), category: 'marketing' as const },
      { key: 'landingVisits', label: 'Landing visits', value: formatNumber(metrics.marketing.landingVisits.value), category: 'marketing' as const },
      { key: 'landingConversionPct', label: 'Landing conversion', value: formatPercent(metrics.marketing.landingConversionPct.value), category: 'marketing' as const },
      { key: 'followersDeltaMonth', label: 'Followers Δ (month)', value: formatNumber(metrics.marketing.followersDeltaMonth.value), category: 'marketing' as const },
      { key: 'followersEndOfMonth', label: 'Followers (EOM)', value: formatNumber(metrics.marketing.followersEndOfMonth.value), category: 'marketing' as const },
    ],
    sales: [
      { key: 'avgRevenuePerDeal', label: 'Avg revenue / deal (gross)', value: formatILS(metrics.sales.avgRevenuePerDeal.grossILS), category: 'sales' as const },
      { key: 'salesCalls', label: 'Sales calls', value: formatNumber(metrics.sales.salesCalls.value), category: 'sales' as const },
      { key: 'closures', label: 'Closures', value: formatNumber(metrics.sales.closures.value), category: 'sales' as const },
      { key: 'closeRatePct', label: 'Close rate', value: formatPercent2Trunc(metrics.sales.closeRatePct.value), category: 'sales' as const },
    ],
    operations: [
      { key: 'activeCustomers', label: 'Active customers', value: formatNumber(metrics.operations.activeCustomers.value), category: 'operations' as const },
      { key: 'cancellations', label: 'Cancellations', value: formatNumber(metrics.operations.cancellations.value), category: 'operations' as const },
      { key: 'referralsWordOfMouth', label: 'Referrals (WoM)', value: formatNumber(metrics.operations.referralsWordOfMouth.value), category: 'operations' as const },
      { key: 'returningCustomers', label: 'Returning customers', value: formatNumber(metrics.operations.returningCustomers.value), category: 'operations' as const },
    ],
  };
}

function SkeletonTile() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="h-4 w-32 rounded bg-slate-100" />
      <div className="mt-3 h-8 w-40 rounded bg-slate-100" />
    </div>
  );
}

function SkeletonSection() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="h-4 w-40 rounded bg-slate-100" />
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="rounded-xl border border-slate-100 bg-white p-4">
            <div className="h-3 w-32 rounded bg-slate-100" />
            <div className="mt-3 h-6 w-24 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { state, lastUpdatedIso } = useDashboardLatest();
  const [refreshState, setRefreshState] = useState<{ status: 'idle' | 'running' | 'ok' | 'error'; message?: string }>(
    () => ({ status: 'idle' }),
  );
  const [density, setDensity] = useState<DensityMode>('comfortable');

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

  const gaps = densityGaps(density);
  const refreshDisabled = refreshState.status === 'running' || state.status === 'disabled';

  return (
    <div className={gaps.page}>
      <Toolbar
        title="Dashboard"
        subtitle={
          <>
            Last updated: <span className="font-medium text-slate-900">{formatLastUpdated(lastUpdatedIso)}</span>
            {latest?.month ? <span className="mx-2 text-slate-300">·</span> : null}
            {latest?.month ? <span className="text-slate-600">Month: {latest.month}</span> : null}
          </>
        }
        density={density}
        onDensityChange={setDensity}
        actions={
          <div className="flex items-center gap-3">
            {refreshState.status === 'error' ? <span className="text-sm text-red-600">{refreshState.message}</span> : null}
            {refreshState.status === 'ok' ? <span className="text-sm text-green-700">{refreshState.message}</span> : null}
            <button
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
              onClick={onRefresh}
              disabled={refreshDisabled}
            >
              {refreshState.status === 'running' ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        }
      />

      {state.status === 'loading' ? (
        <div className={['grid grid-cols-12', gaps.grid].join(' ')}>
          <div className={['col-span-12 grid grid-cols-2 md:grid-cols-4', gaps.tiles].join(' ')}>
            {Array.from({ length: 4 }).map((_, idx) => (
              <SkeletonTile key={idx} />
            ))}
          </div>
          <div className="col-span-12">
            <SkeletonSection />
          </div>
          <div className="col-span-12">
            <SkeletonSection />
          </div>
        </div>
      ) : null}

      {state.status === 'error' ? (
        <Card>
          <p className="text-sm text-red-600">{state.error}</p>
        </Card>
      ) : null}

      {state.status === 'ready' && !latest ? (
        <Card>
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <h2 className="text-lg font-semibold text-slate-900">No dashboard data yet</h2>
            <p className="max-w-xl text-sm text-slate-600">No data found at `dashboard/latest`. Run a Refresh to generate the latest dashboard.</p>
            <button
              className="mt-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
              onClick={onRefresh}
              disabled={refreshDisabled}
            >
              {refreshState.status === 'running' ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </Card>
      ) : null}

      {metrics && kpis ? (
        <>
          <div className={['grid grid-cols-12', gaps.grid].join(' ')}>
            <div className={['col-span-12 grid grid-cols-2 md:grid-cols-4', gaps.tiles].join(' ')}>
              <KpiTile category="financial" label="Monthly revenue (gross)" value={formatILS(metrics.financial.monthlyRevenue.grossILS)} />
              <KpiTile category="marketing" label="Total leads" value={formatNumber(metrics.marketing.totalLeads.value)} />
              <KpiTile category="sales" label="Closures" value={formatNumber(metrics.sales.closures.value)} />
              <KpiTile category="operations" label="Active customers" value={formatNumber(metrics.operations.activeCustomers.value)} />
            </div>

            <div className="col-span-12">
              <div className={['grid grid-cols-12', gaps.grid].join(' ')}>
                <div className="col-span-12 xl:col-span-6">
                  <SectionCard
                    category="financial"
                    title="Financial"
                    subtitle="Revenue, cashflow and expenses"
                  >
                    <KpiGrid items={kpis.financial} />
                  </SectionCard>
                </div>

                <div className="col-span-12 xl:col-span-6">
                  <SectionCard
                    category="marketing"
                    title="Marketing"
                    subtitle="Lead volume and top-of-funnel"
                  >
                    <KpiGrid items={kpis.marketing} />
                  </SectionCard>
                </div>

                <div className="col-span-12 xl:col-span-6">
                  <SectionCard
                    category="sales"
                    title="Sales"
                    subtitle="Calls, closures, and conversion"
                  >
                    <KpiGrid items={kpis.sales} />
                  </SectionCard>
                </div>

                <div className="col-span-12 xl:col-span-6">
                  <SectionCard
                    category="operations"
                    title="Operations"
                    subtitle="Customers, retention, and referrals"
                  >
                    <KpiGrid items={kpis.operations} />
                  </SectionCard>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}


