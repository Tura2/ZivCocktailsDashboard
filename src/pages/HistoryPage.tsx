import { useMemo, useState } from 'react';
import Card from '@/components/dashboard/Card';
import KpiGrid from '@/components/dashboard/KpiGrid';
import type { TrendDirection } from '@/components/dashboard/KpiCard';
import { firebaseEnabled, firestore } from '@/lib/firebase';
import type { YYYYMM } from '@/lib/dashboard/types';
import { useSnapshots } from '@/lib/snapshots/useSnapshots';
import type { DiffCountLeaf, DiffMoneyLeaf, SnapshotDoc } from '@/lib/snapshots/types';
import type { SnapshotRecord } from '@/lib/snapshots/types';
import { doc, getDoc } from 'firebase/firestore';
import { exportSnapshotToCsv, exportSnapshotToPdf, exportSnapshotToXlsx, saveBytesAsFile, saveTextAsFile } from '@/export';

const DEFAULT_RECENT_MONTHS = 6;
const MAX_MONTHS_TO_FETCH = 60;

function parseYYYYMM(month: string): { y: number; m: number } | null {
  const m1 = /^([0-9]{4})-([0-9]{2})$/.exec(month);
  if (!m1) return null;
  const y = Number(m1[1]);
  const m = Number(m1[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null;
  return { y, m };
}

function formatYYYYMM({ y, m }: { y: number; m: number }): YYYYMM {
  return `${y}-${String(m).padStart(2, '0')}` as YYYYMM;
}

function addMonths(month: YYYYMM, deltaMonths: number): YYYYMM {
  const p = parseYYYYMM(month);
  if (!p) return month;
  const idx = p.y * 12 + (p.m - 1) + deltaMonths;
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  return formatYYYYMM({ y, m });
}

function listMonthsInclusive(start: YYYYMM, end: YYYYMM): YYYYMM[] {
  if (start > end) return listMonthsInclusive(end, start);
  const out: YYYYMM[] = [];
  let cur = start;
  while (cur <= end) {
    out.push(cur);
    const next = addMonths(cur, 1);
    if (next === cur) break;
    cur = next;
  }
  return out;
}

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

function formatPercentValue(value: number | null | undefined) {
  if (value == null) return '—';
  return `${value}%`;
}

function formatLastUpdated(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function trendFromPct(pct: number | null | undefined): { trendLabel?: string; trendDirection?: TrendDirection } {
  if (pct == null) return { trendLabel: '—', trendDirection: 'neutral' };
  const rounded = Math.round(pct);
  const sign = rounded > 0 ? '+' : '';
  const dir: TrendDirection = rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'neutral';
  return { trendLabel: `${sign}${rounded}%`, trendDirection: dir };
}

function trendFromCountLeaf(leaf: DiffCountLeaf | null | undefined) {
  return trendFromPct(leaf?.valuePct ?? null);
}

function trendFromMoneyLeafGross(leaf: DiffMoneyLeaf | null | undefined) {
  return trendFromPct(leaf?.grossPct ?? null);
}

function trendFromMoneyLeafNet(leaf: DiffMoneyLeaf | null | undefined) {
  return trendFromPct(leaf?.netPct ?? null);
}

function buildKpis(snapshot: SnapshotDoc) {
  const m = snapshot.metrics;
  const d = snapshot.diffFromPreviousPct;

  return {
    financial: [
      {
        key: 'monthlyRevenueGross',
        label: 'Monthly revenue (gross)',
        value: formatILS(m.financial.monthlyRevenue.grossILS),
        ...trendFromMoneyLeafGross(d.financial.monthlyRevenue),
      },
      {
        key: 'expectedCashflowGross',
        label: 'Expected cashflow (gross)',
        value: formatILS(m.financial.expectedCashflow.grossILS),
        ...trendFromMoneyLeafGross(d.financial.expectedCashflow),
      },
      {
        key: 'expectedExpensesGross',
        label: 'Expected expenses (gross)',
        value: formatILS(m.financial.expectedExpenses.grossILS),
        ...trendFromMoneyLeafGross(d.financial.expectedExpenses),
      },
      {
        key: 'monthlyRevenueNet',
        label: 'Monthly revenue (net)',
        value: formatILS(m.financial.monthlyRevenue.netILS),
        ...trendFromMoneyLeafNet(d.financial.monthlyRevenue),
      },
    ],
    marketing: [
      {
        key: 'totalLeads',
        label: 'Total leads',
        value: formatNumber(m.marketing.totalLeads.value),
        ...trendFromCountLeaf(d.marketing.totalLeads),
      },
      {
        key: 'relevantLeads',
        label: 'Relevant leads',
        value: formatNumber(m.marketing.relevantLeads.value),
        ...trendFromCountLeaf(d.marketing.relevantLeads),
      },
      {
        key: 'landingVisits',
        label: 'Landing visits',
        value: formatNumber(m.marketing.landingVisits.value),
        ...trendFromCountLeaf(d.marketing.landingVisits),
      },
      {
        key: 'landingConversionPct',
        label: 'Landing conversion',
        value: formatPercentValue(m.marketing.landingConversionPct.value),
        ...trendFromCountLeaf(d.marketing.landingConversionPct),
      },
      {
        key: 'followersDeltaMonth',
        label: 'Followers Δ (month)',
        value: formatNumber(m.marketing.followersDeltaMonth.value),
        ...trendFromCountLeaf(d.marketing.followersDeltaMonth),
      },
      {
        key: 'followersEndOfMonth',
        label: 'Followers (EOM)',
        value: formatNumber(m.marketing.followersEndOfMonth.value),
        ...trendFromCountLeaf(d.marketing.followersEndOfMonth),
      },
    ],
    sales: [
      {
        key: 'avgRevenuePerDealGross',
        label: 'Avg revenue / deal (gross)',
        value: formatILS(m.sales.avgRevenuePerDeal.grossILS),
        ...trendFromMoneyLeafGross(d.sales.avgRevenuePerDeal),
      },
      {
        key: 'salesCalls',
        label: 'Sales calls',
        value: formatNumber(m.sales.salesCalls.value),
        ...trendFromCountLeaf(d.sales.salesCalls),
      },
      {
        key: 'closures',
        label: 'Closures',
        value: formatNumber(m.sales.closures.value),
        ...trendFromCountLeaf(d.sales.closures),
      },
      {
        key: 'closeRatePct',
        label: 'Close rate',
        value: formatPercentValue(m.sales.closeRatePct.value),
        ...trendFromCountLeaf(d.sales.closeRatePct),
      },
    ],
    operations: [
      {
        key: 'activeCustomers',
        label: 'Active customers',
        value: formatNumber(m.operations.activeCustomers.value),
        ...trendFromCountLeaf(d.operations.activeCustomers),
      },
      {
        key: 'cancellations',
        label: 'Cancellations',
        value: formatNumber(m.operations.cancellations.value),
        ...trendFromCountLeaf(d.operations.cancellations),
      },
      {
        key: 'referralsWordOfMouth',
        label: 'Referrals (WoM)',
        value: formatNumber(m.operations.referralsWordOfMouth.value),
        ...trendFromCountLeaf(d.operations.referralsWordOfMouth),
      },
      {
        key: 'returningCustomers',
        label: 'Returning customers',
        value: formatNumber(m.operations.returningCustomers.value),
        ...trendFromCountLeaf(d.operations.returningCustomers),
      },
    ],
  };
}

function CategorySection({ title, items }: { title: string; items: Parameters<typeof KpiGrid>[0]['items'] }) {
  return (
    <section className="mt-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">{title}</h3>
      </div>
      <KpiGrid items={items} className="xl:grid-cols-4" />
    </section>
  );
}

type LineSeries = { label: string; points: Array<number | null>; className: string };

function SvgLineChart({ labels, series }: { labels: string[]; series: LineSeries[] }) {
  const width = 520;
  const height = 160;

  const allNumbers = series.flatMap((s) => s.points).filter((v): v is number => v != null);
  const max = Math.max(...allNumbers, 1);

  const xAt = (idx: number) => (idx / Math.max(labels.length - 1, 1)) * width;
  const yAt = (v: number) => height - (v / max) * height;

  const buildSegments = (points: Array<number | null>) => {
    const segs: string[] = [];
    let current: string[] = [];

    for (let i = 0; i < points.length; i++) {
      const v = points[i];
      if (v == null) {
        if (current.length >= 2) segs.push(current.join(' '));
        current = [];
        continue;
      }
      current.push(`${xAt(i)},${yAt(v)}`);
    }

    if (current.length >= 2) segs.push(current.join(' '));
    return segs;
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-36 w-full" aria-hidden>
        {series.map((s) => {
          const segs = buildSegments(s.points);
          return segs.map((poly, idx) => (
            <polyline
              key={`${s.label}-${idx}`}
              fill="none"
              stroke="currentColor"
              className={s.className}
              strokeWidth={3}
              strokeLinejoin="round"
              strokeLinecap="round"
              points={poly}
            />
          ));
        })}
      </svg>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {series.map((s) => (
          <div key={s.label} className="inline-flex items-center gap-2 text-sm text-slate-600">
            <span className={`inline-block h-2 w-6 rounded-full ${s.className}`} aria-hidden />
            <span>{s.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {labels.map((l) => (
          <div key={l} className="rounded-md bg-white px-3 py-2 text-xs text-slate-600">
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniBarChart({ labels, values }: { labels: string[]; values: Array<number | null> }) {
  const numbers = values.filter((v): v is number => v != null);
  const max = Math.max(...numbers, 1);

  return (
    <div className="mt-4 grid gap-3">
      {labels.map((label, idx) => {
        const raw = values[idx];
        if (raw == null) {
          return (
            <div key={label} className="grid grid-cols-[120px,1fr,90px] items-center gap-3">
              <div className="text-sm text-slate-600">{label}</div>
              <div className="h-2 rounded-full bg-slate-100" />
              <div className="text-right text-sm font-medium text-slate-900">—</div>
            </div>
          );
        }
        const widthPct = Math.max(2, Math.round((raw / max) * 100));
        return (
          <div key={label} className="grid grid-cols-[120px,1fr,90px] items-center gap-3">
            <div className="text-sm text-slate-600">{label}</div>
            <div className="h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${widthPct}%` }} />
            </div>
            <div className="text-right text-sm font-medium text-slate-900">{formatNumber(raw)}</div>
          </div>
        );
      })}
    </div>
  );
}

export function HistoryPage() {
  const { state } = useSnapshots({ limit: MAX_MONTHS_TO_FETCH });
  const [startMonth, setStartMonth] = useState<YYYYMM | ''>('');
  const [endMonth, setEndMonth] = useState<YYYYMM | ''>('');
  const [exportState, setExportState] = useState<
    | { status: 'idle' }
    | { status: 'running'; month: YYYYMM; format: 'csv' | 'xlsx' | 'pdf' }
    | { status: 'ok'; message: string }
    | { status: 'error'; message: string }
  >({ status: 'idle' });

  const snapshots = state.status === 'ready' ? state.data : [];
  const byMonth = useMemo(() => new Map<YYYYMM, SnapshotDoc>(snapshots.map((s) => [s.month, s])), [snapshots]);

  const availableMonthsAsc = useMemo(() => {
    const months = snapshots.map((s) => s.month);
    months.sort();
    return months;
  }, [snapshots]);

  const viewMonthsDesc = useMemo(() => {
    if (state.status !== 'ready') return [] as YYYYMM[];

    const hasSelection = Boolean(startMonth || endMonth);
    if (!hasSelection) {
      const recentDocs = snapshots.slice(0, DEFAULT_RECENT_MONTHS);
      const months = recentDocs.map((s) => s.month);
      if (months.length <= 1) return months;
      const newest = months[0];
      const oldest = months[months.length - 1];
      return listMonthsInclusive(oldest, newest).reverse();
    }

    const s = (startMonth || endMonth) as YYYYMM;
    const e = (endMonth || startMonth || endMonth) as YYYYMM;
    return listMonthsInclusive(s, e).reverse();
  }, [state.status, snapshots, startMonth, endMonth]);

  const chartMonthsAsc = useMemo(() => {
    const asc = [...viewMonthsDesc];
    asc.reverse();
    return asc;
  }, [viewMonthsDesc]);

  const revenueGrossSeries = useMemo(() => {
    return chartMonthsAsc.map((m) => byMonth.get(m)?.metrics.financial.monthlyRevenue.grossILS ?? null);
  }, [chartMonthsAsc, byMonth]);

  const revenueNetSeries = useMemo(() => {
    return chartMonthsAsc.map((m) => byMonth.get(m)?.metrics.financial.monthlyRevenue.netILS ?? null);
  }, [chartMonthsAsc, byMonth]);

  const totalLeadsSeries = useMemo(() => {
    return chartMonthsAsc.map((m) => byMonth.get(m)?.metrics.marketing.totalLeads.value ?? null);
  }, [chartMonthsAsc, byMonth]);

  if (!firebaseEnabled) {
    return (
      <Card>
        <h1 className="text-lg font-semibold text-slate-900">History</h1>
        <p className="mt-2 text-sm text-slate-600">Firebase is not configured. Add `VITE_*` env vars to enable Firestore reads.</p>
      </Card>
    );
  }

  const exportMonth = async (month: YYYYMM, format: 'csv' | 'xlsx' | 'pdf') => {
    if (!firestore) {
      setExportState({ status: 'error', message: 'Firestore is not configured.' });
      return;
    }

    setExportState({ status: 'running', month, format });
    try {
      // MUST read the snapshot doc before exporting.
      const ref = doc(firestore, 'snapshots', month);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        setExportState({ status: 'error', message: `No snapshot found at snapshots/${month}` });
        return;
      }

      const snapshot = snap.data() as SnapshotRecord;
      const base = `ziv-cocktails_snapshot_${month}`;

      if (format === 'csv') {
        const csv = exportSnapshotToCsv(snapshot);
        saveTextAsFile(csv, `${base}.csv`, 'text/csv;charset=utf-8');
        setExportState({ status: 'ok', message: `Exported ${month} to CSV.` });
        return;
      }

      if (format === 'xlsx') {
        const ab = exportSnapshotToXlsx(snapshot);
        saveBytesAsFile(ab, `${base}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        setExportState({ status: 'ok', message: `Exported ${month} to XLSX.` });
        return;
      }

      const pdf = exportSnapshotToPdf(snapshot);
      saveBytesAsFile(pdf, `${base}.pdf`, 'application/pdf');
      setExportState({ status: 'ok', message: `Exported ${month} to PDF.` });
    } catch (e) {
      const err = e as Error;
      setExportState({ status: 'error', message: err.message || 'Export failed' });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">History</h1>
        <p className="mt-1 text-sm text-slate-600">Monthly snapshots from Firestore (`snapshots/{'{YYYY-MM}'}`). Diffs are shown from stored `diffFromPreviousPct` (no recompute).</p>
      </div>

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm font-medium text-slate-900">Month selection</div>
            <div className="mt-1 text-sm text-slate-600">Choose a single month or a range. Leave blank to see the most recent {DEFAULT_RECENT_MONTHS} months.</div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <span className="w-16">Start</span>
              <select
                className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900"
                value={startMonth}
                onChange={(e) => setStartMonth((e.target.value as YYYYMM) || '')}
                disabled={state.status !== 'ready'}
              >
                <option value="">(auto)</option>
                {availableMonthsAsc.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-600">
              <span className="w-16">End</span>
              <select
                className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900"
                value={endMonth}
                onChange={(e) => setEndMonth((e.target.value as YYYYMM) || '')}
                disabled={state.status !== 'ready'}
              >
                <option value="">(same as start)</option>
                {availableMonthsAsc.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>

            <button
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 disabled:opacity-60"
              onClick={() => {
                setStartMonth('');
                setEndMonth('');
              }}
              disabled={!startMonth && !endMonth}
            >
              Reset
            </button>
          </div>
        </div>
      </Card>

      {exportState.status === 'running' ? (
        <Card>
          <p className="text-sm text-slate-600">
            Exporting {exportState.month} to {exportState.format.toUpperCase()}…
          </p>
        </Card>
      ) : null}

      {exportState.status === 'ok' ? (
        <Card>
          <p className="text-sm text-green-700">{exportState.message}</p>
        </Card>
      ) : null}

      {exportState.status === 'error' ? (
        <Card>
          <p className="text-sm text-red-600">{exportState.message}</p>
        </Card>
      ) : null}

      {state.status === 'loading' ? (
        <Card>
          <p className="text-sm text-slate-600">Loading `snapshots/*`…</p>
        </Card>
      ) : null}

      {state.status === 'error' ? (
        <Card>
          <p className="text-sm text-red-600">{state.error}</p>
        </Card>
      ) : null}

      {state.status === 'ready' && snapshots.length === 0 ? (
        <Card>
          <h2 className="text-lg font-semibold text-slate-900">No snapshots yet</h2>
          <p className="mt-2 text-sm text-slate-600">No documents found under `snapshots/*`. Run a Refresh to generate snapshots, then come back here.</p>
        </Card>
      ) : null}

      {state.status === 'ready' && viewMonthsDesc.length > 0 ? (
        <div className="grid gap-4">
          <Card>
            <h2 className="text-lg font-semibold text-slate-900">Trends</h2>
            <p className="mt-1 text-sm text-slate-600">Charts are derived from snapshots. Null values are skipped.</p>
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-slate-700">Revenue (gross vs net)</h3>
              <div className="mt-2">
                <SvgLineChart
                  labels={chartMonthsAsc}
                  series={[
                    { label: 'Gross ILS', points: revenueGrossSeries, className: 'text-indigo-600' },
                    { label: 'Net ILS', points: revenueNetSeries, className: 'text-slate-600' },
                  ]}
                />
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-semibold text-slate-700">Marketing volume (Total leads)</h3>
              <MiniBarChart labels={chartMonthsAsc} values={totalLeadsSeries} />
            </div>
          </Card>

          {viewMonthsDesc.map((month) => {
            const snap = byMonth.get(month) ?? null;
            if (!snap) {
              return (
                <Card key={month}>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                    <h2 className="text-lg font-semibold text-slate-900">{month}</h2>
                    <div className="text-sm text-slate-500">Missing snapshot</div>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">No document exists at `snapshots/{month}`. Gaps are allowed.</p>
                </Card>
              );
            }

            const kpis = buildKpis(snap);

            return (
              <Card key={month}>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{snap.month}</h2>
                    <div className="mt-1 text-sm text-slate-500">Computed: {formatLastUpdated(snap.computedAt)}</div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2 sm:mt-0">
                    <span className="text-sm text-slate-600">Export:</span>
                    <button
                      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 disabled:opacity-60"
                      onClick={() => exportMonth(snap.month, 'csv')}
                      disabled={exportState.status === 'running'}
                      aria-label={`Export ${snap.month} as CSV`}
                    >
                      CSV
                    </button>
                    <button
                      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 disabled:opacity-60"
                      onClick={() => exportMonth(snap.month, 'xlsx')}
                      disabled={exportState.status === 'running'}
                      aria-label={`Export ${snap.month} as XLSX`}
                    >
                      XLSX
                    </button>
                    <button
                      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 disabled:opacity-60"
                      onClick={() => exportMonth(snap.month, 'pdf')}
                      disabled={exportState.status === 'running'}
                      aria-label={`Export ${snap.month} as PDF`}
                    >
                      PDF
                    </button>
                  </div>
                </div>

                <CategorySection title="Financial" items={kpis.financial} />
                <CategorySection title="Marketing" items={kpis.marketing} />
                <CategorySection title="Sales" items={kpis.sales} />
                <CategorySection title="Operations" items={kpis.operations} />
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
