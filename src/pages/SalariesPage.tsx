import { useEffect, useMemo, useState } from 'react';

import { Toolbar } from '@/components/ui/Toolbar';
import { densityGaps } from '@/ui/density';
import { fetchSalaries, type SalariesRow } from '@/lib/api/salaries';

function monthKeyLocal(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function SalariesPage() {
  const [density] = useState<'comfortable' | 'compact'>('comfortable');

  const [month, setMonth] = useState(() => monthKeyLocal(new Date()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<SalariesRow[]>([]);

  const gap = densityGaps(density);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  }, [rows]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSalaries(month);
      if (!res.ok) {
        setError(res.message);
        setRows([]);
        return;
      }
      setRows(res.rows);
    } catch (e) {
      const err = e as any;
      setError(String(err?.message ?? 'Failed to load salaries'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  return (
    <div className={gap.page}>
      <Toolbar
        title="Salaries"
        subtitle={
          <span>
            Staff Directory → events in <span className="font-medium text-slate-900">{month}</span>
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm text-slate-700">
              <span className="sr-only">Month</span>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm"
              />
            </label>
            <button
              type="button"
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
              onClick={load}
              disabled={loading}
            >
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        }
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        ) : null}

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3 text-right">Events</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map((r) => (
                <tr key={r.staffTaskId} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{r.name || '—'}</td>
                  <td className="px-4 py-3 text-slate-700">{r.phone || '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-900">{r.eventCount}</td>
                </tr>
              ))}

              {loading ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-slate-600">
                    Loading…
                  </td>
                </tr>
              ) : null}

              {!loading && sorted.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-slate-600">
                    No employees found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
