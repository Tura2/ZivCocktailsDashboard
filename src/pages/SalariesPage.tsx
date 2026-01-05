import { Fragment, useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, SquarePen } from 'lucide-react';

import { Toolbar } from '@/components/ui/Toolbar';
import Card from '@/components/dashboard/Card';
import { densityGaps } from '@/ui/density';
import { fetchSalaries, type SalariesRow } from '@/lib/api/salaries';
import { saveSalary } from '@/lib/api/salarySave';

function monthKeyLocal(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

function formatILS(value: number): string {
  try {
    return new Intl.NumberFormat('en-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${Math.trunc(value)} ₪`;
  }
}

function formatNumber(value: number): string {
  try {
    return new Intl.NumberFormat('en-IL', { maximumFractionDigits: 0 }).format(value);
  } catch {
    return String(Math.trunc(value));
  }
}

function ILSAmount(props: { value: number; className?: string }) {
  return (
    <span className={['inline-flex items-center gap-1 tabular-nums', props.className ?? ''].join(' ')}>
      <span>{formatNumber(props.value)}</span>
      <span aria-hidden="true">₪</span>
    </span>
  );
}

function formatEventDate(ms: number): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return String(ms);
  return d.toLocaleDateString();
}

function IconButton(props: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={props.label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      onClick={props.onClick}
      disabled={props.disabled}
    >
      {props.children}
    </button>
  );
}

function ViewModeToggle(props: {
  mode: 'formula' | 'table';
  onChange: (next: 'formula' | 'table') => void;
}) {
  const isTable = props.mode === 'table';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isTable}
      aria-label="Toggle Salaries view"
      className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-50"
      onClick={() => props.onChange(isTable ? 'formula' : 'table')}
    >
      <span className="text-slate-700">Formula</span>
      <span
        className={[
          'relative inline-flex h-6 w-11 items-center rounded-full border border-slate-200 bg-slate-100 transition-colors',
          isTable ? 'bg-slate-900' : 'bg-slate-100',
        ].join(' ')}
        aria-hidden
      >
        <span
          className={[
            'inline-block h-5 w-5 translate-x-0 rounded-full bg-white shadow-sm transition-transform',
            isTable ? 'translate-x-5' : 'translate-x-1',
          ].join(' ')}
        />
      </span>
      <span className="text-slate-700">Table</span>
    </button>
  );
}

type RowUiState = {
  expanded: boolean;
  editing: boolean;
  saving: boolean;
  draftBaseRate: string;
  draftVideosCount: string;
  draftBonus: string;
};

function toRowUi(r: SalariesRow): RowUiState {
  return {
    expanded: false,
    editing: false,
    saving: false,
    draftBaseRate: String(Math.trunc(r.baseRate ?? 0)),
    draftVideosCount: String(Math.trunc(r.videosCount ?? 0)),
    draftBonus: String(r.bonus ?? 0),
  };
}

function parseNonNegInt(s: string): number {
  const n = Math.trunc(Number(s));
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function parseNonNegNum(s: string): number {
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

export function SalariesPage() {
  const [density] = useState<'comfortable' | 'compact'>('comfortable');

  const [viewMode, setViewMode] = useState<'formula' | 'table'>(() => 'formula');

  const [month, setMonth] = useState(() => monthKeyLocal(new Date()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<SalariesRow[]>([]);
  const [ui, setUi] = useState<Record<string, RowUiState>>({});

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
        setUi({});
        return;
      }
      setRows(res.rows);
      setUi((prev) => {
        const next: Record<string, RowUiState> = { ...prev };
        for (const r of res.rows) {
          if (!next[r.staffTaskId]) next[r.staffTaskId] = toRowUi(r);
          // If server updated persisted values, refresh drafts only when not editing.
          const cur = next[r.staffTaskId];
          if (cur && !cur.editing) {
            next[r.staffTaskId] = {
              ...cur,
              draftBaseRate: String(Math.trunc(r.baseRate ?? 0)),
              draftVideosCount: String(Math.trunc(r.videosCount ?? 0)),
              draftBonus: String(r.bonus ?? 0),
            };
          }
        }
        return next;
      });
    } catch (e) {
      const err = e as any;
      setError(String(err?.message ?? 'Failed to load salaries'));
      setRows([]);
      setUi({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  async function handleSave(row: SalariesRow) {
    const state = ui[row.staffTaskId];
    if (!state) return;

    const baseRate = parseNonNegInt(state.draftBaseRate);
    const videosCount = parseNonNegInt(state.draftVideosCount);
    const bonus = parseNonNegNum(state.draftBonus);

    const changed = baseRate !== row.baseRate || videosCount !== row.videosCount || bonus !== row.bonus;
    if (!changed) {
      setUi((prev) => ({
        ...prev,
        [row.staffTaskId]: { ...prev[row.staffTaskId], editing: false },
      }));
      return;
    }

    setUi((prev) => ({
      ...prev,
      [row.staffTaskId]: { ...prev[row.staffTaskId], saving: true },
    }));

    try {
      const res = await saveSalary({
        month,
        staffTaskId: row.staffTaskId,
        baseRate,
        videosCount,
        bonus,
        events: row.events,
      });

      if (!res.ok) {
        setError(res.message);
        return;
      }

      setRows((prev) =>
        prev.map((r) => {
          if (r.staffTaskId !== row.staffTaskId) return r;
          const eventCount = r.eventCount;
          const eventsTotal = eventCount * baseRate;
          const videosTotal = videosCount * 50;
          const total = eventsTotal + videosTotal + bonus;
          return {
            ...r,
            baseRate,
            videosCount,
            bonus,
            eventsTotal,
            videosTotal,
            total,
          };
        }),
      );

      setUi((prev) => ({
        ...prev,
        [row.staffTaskId]: { ...prev[row.staffTaskId], editing: false },
      }));
    } finally {
      setUi((prev) => ({
        ...prev,
        [row.staffTaskId]: { ...prev[row.staffTaskId], saving: false },
      }));
    }
  }

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

            <ViewModeToggle mode={viewMode} onChange={setViewMode} />

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

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-sm">Loading…</div>
      ) : null}

      {!loading && sorted.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-sm">No employees found.</div>
      ) : null}

      {viewMode === 'table' ? (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3 text-center">Events</th>
                  <th className="px-4 py-3 text-center">Recommendation</th>
                  <th className="px-4 py-3 text-center">Bonus</th>
                  <th className="px-4 py-3 text-center">Total</th>
                  <th className="px-4 py-3 text-right"></th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {sorted.map((r) => {
                  const state = ui[r.staffTaskId] ?? toRowUi(r);

                  const draftBaseRate = parseNonNegInt(state.draftBaseRate);
                  const draftVideos = parseNonNegInt(state.draftVideosCount);
                  const draftBonus = parseNonNegNum(state.draftBonus);

                  const eventsTotal = r.eventCount * (state.editing ? draftBaseRate : r.baseRate);
                  const videosTotal = (state.editing ? draftVideos : r.videosCount) * 50;
                  const bonus = state.editing ? draftBonus : r.bonus;
                  const total = eventsTotal + videosTotal + bonus;

                  const eventTooltip = r.events.length ? r.events.map((e) => e.name).join('\n') : 'No events';

                  return (
                    <Fragment key={r.staffTaskId}>
                      <tr className="align-top">
                        <td className="px-4 py-3">
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-slate-900">{r.name || '—'}</div>
                            <div className="mt-1 truncate text-xs text-slate-600">{r.phone || '—'}</div>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-center" title={eventTooltip}>
                          <div className="flex flex-col items-center gap-2">
                            <ILSAmount value={eventsTotal} className="font-medium text-slate-900" />
                            {state.editing ? (
                              <span className="inline-flex items-center gap-1">
                                <input
                                  inputMode="numeric"
                                  className="h-9 w-20 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900 shadow-sm"
                                  value={state.draftBaseRate}
                                  onChange={(e) =>
                                    setUi((prev) => {
                                      const cur = prev[r.staffTaskId] ?? toRowUi(r);
                                      return { ...prev, [r.staffTaskId]: { ...cur, draftBaseRate: e.target.value } };
                                    })
                                  }
                                />
                                <span aria-hidden="true">₪</span>
                              </span>
                            ) : null}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <ILSAmount value={videosTotal} className="font-medium text-slate-900" />
                            {state.editing ? (
                              <input
                                inputMode="numeric"
                                className="h-9 w-16 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900 shadow-sm"
                                value={state.draftVideosCount}
                                onChange={(e) =>
                                  setUi((prev) => {
                                    const cur = prev[r.staffTaskId] ?? toRowUi(r);
                                    return { ...prev, [r.staffTaskId]: { ...cur, draftVideosCount: e.target.value } };
                                  })
                                }
                              />
                            ) : null}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-center">
                          {state.editing ? (
                            <div className="flex flex-col items-center gap-2">
                              <input
                                inputMode="decimal"
                                className="h-9 w-28 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900 shadow-sm"
                                value={state.draftBonus}
                                onChange={(e) =>
                                  setUi((prev) => {
                                    const cur = prev[r.staffTaskId] ?? toRowUi(r);
                                    return { ...prev, [r.staffTaskId]: { ...cur, draftBonus: e.target.value } };
                                  })
                                }
                              />
                              <span className="text-xs text-slate-500">Defaults to 0</span>
                            </div>
                          ) : (
                            <ILSAmount value={bonus} className="font-medium text-slate-900" />
                          )}
                        </td>

                        <td className="px-4 py-3 text-center">
                          <ILSAmount value={total} className="font-semibold text-slate-900" />
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <IconButton
                              label={state.editing ? 'Save' : 'Edit'}
                              onClick={() => {
                                if (state.editing) {
                                  void handleSave(r);
                                } else {
                                  setUi((prev) => ({
                                    ...prev,
                                    [r.staffTaskId]: { ...toRowUi(r), ...(prev[r.staffTaskId] ?? {}), editing: true },
                                  }));
                                }
                              }}
                              disabled={state.saving}
                            >
                              {state.editing ? <Check className="h-4 w-4" /> : <SquarePen className="h-4 w-4" />}
                            </IconButton>

                            <IconButton
                              label={state.expanded ? 'Collapse' : 'Expand'}
                              onClick={() =>
                                setUi((prev) => {
                                  const cur = prev[r.staffTaskId] ?? toRowUi(r);
                                  return { ...prev, [r.staffTaskId]: { ...cur, expanded: !cur.expanded } };
                                })
                              }
                            >
                              <ChevronDown className={['h-4 w-4 transition-transform', state.expanded ? 'rotate-180' : ''].join(' ')} />
                            </IconButton>
                          </div>
                        </td>
                      </tr>

                      {state.expanded ? (
                        <tr>
                          <td colSpan={6} className="px-4 pb-4">
                            <div className="grid gap-4 lg:grid-cols-2">
                              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <div className="text-sm font-semibold text-slate-900">Payment history</div>
                                <div className="mt-2 text-sm text-slate-600">Placeholder (Full/Partial status will appear here).</div>
                              </div>

                              <div className="rounded-xl border border-slate-200 bg-white p-4">
                                <div className="text-sm font-semibold text-slate-900">Events this month</div>
                                <div className="mt-3 overflow-x-auto">
                                  <table className="min-w-full text-left text-sm">
                                    <thead className="text-xs uppercase tracking-wide text-slate-500">
                                      <tr>
                                        <th className="py-2 pr-3">Event</th>
                                        <th className="py-2 text-right">Date</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {r.events.map((e) => (
                                        <tr key={e.taskId} className="hover:bg-slate-50">
                                          <td className="py-2 pr-3 text-slate-900">{e.name}</td>
                                          <td className="py-2 text-right tabular-nums text-slate-700">{formatEventDate(e.requestedDateMs)}</td>
                                        </tr>
                                      ))}
                                      {r.events.length === 0 ? (
                                        <tr>
                                          <td colSpan={2} className="py-4 text-center text-slate-600">
                                            No events.
                                          </td>
                                        </tr>
                                      ) : null}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <div className={[gap.tiles, 'flex flex-col'].join(' ')}>
          {sorted.map((r) => {
            const state = ui[r.staffTaskId] ?? toRowUi(r);

            const draftBaseRate = parseNonNegInt(state.draftBaseRate);
            const draftVideos = parseNonNegInt(state.draftVideosCount);
            const draftBonus = parseNonNegNum(state.draftBonus);

            const eventsTotal = r.eventCount * (state.editing ? draftBaseRate : r.baseRate);
            const videosTotal = (state.editing ? draftVideos : r.videosCount) * 50;
            const bonus = state.editing ? draftBonus : r.bonus;
            const total = eventsTotal + videosTotal + bonus;

            const eventTooltip = r.events.length ? r.events.map((e) => e.name).join('\n') : 'No events';

            return (
              <Card key={r.staffTaskId} className="p-4">
                {/* Closed state: summary row */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 sm:w-56">
                    <div className="truncate text-base font-semibold text-slate-900">{r.name || '—'}</div>
                    <div className="mt-1 text-sm text-slate-600">{r.phone || '—'}</div>
                  </div>

                  <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                    {/* Formula (centered within available space) */}
                    <div className="sm:flex-1 sm:self-stretch">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-700 sm:justify-center">
                        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1" title={eventTooltip}>
                          <span className="font-medium">{r.eventCount}</span>
                          <span className="font-medium">Events</span>
                          <span className="text-slate-400">×</span>
                          {state.editing ? (
                            <span className="inline-flex items-center gap-1">
                              <input
                                inputMode="numeric"
                                className="h-9 w-20 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900 shadow-sm"
                                value={state.draftBaseRate}
                                onChange={(e) =>
                                  setUi((prev) => {
                                    const cur = prev[r.staffTaskId] ?? toRowUi(r);
                                    return { ...prev, [r.staffTaskId]: { ...cur, draftBaseRate: e.target.value } };
                                  })
                                }
                              />
                              <span aria-hidden="true">₪</span>
                            </span>
                          ) : (
                            <ILSAmount value={r.baseRate} className="font-medium" />
                          )}
                          <span className="text-slate-400">=</span>
                          <ILSAmount value={eventsTotal} className="font-medium" />
                        </span>

                        <span className="text-slate-400">+</span>

                        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                          {state.editing ? (
                            <input
                              inputMode="numeric"
                              className="h-9 w-16 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900 shadow-sm"
                              value={state.draftVideosCount}
                              onChange={(e) =>
                                setUi((prev) => {
                                  const cur = prev[r.staffTaskId] ?? toRowUi(r);
                                  return { ...prev, [r.staffTaskId]: { ...cur, draftVideosCount: e.target.value } };
                                })
                              }
                            />
                          ) : (
                            <span className="font-medium">{r.videosCount}</span>
                          )}
                          <span className="font-medium">Recommendation</span>
                          <span className="text-slate-400">×</span>
                          <ILSAmount value={50} className="font-medium" />
                          <span className="text-slate-400">=</span>
                          <ILSAmount value={videosTotal} className="font-medium" />
                        </span>

                        <span className="text-slate-400">+</span>

                        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-medium">Bonus</span>
                          <span className="text-slate-500">=</span>
                          <ILSAmount value={bonus} className="font-medium" />
                        </span>
                      </div>
                    </div>

                    {/* Total + Controls (right aligned) */}
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <div className="text-lg font-semibold tabular-nums text-slate-900">
                        <ILSAmount value={total} className="font-semibold" />
                      </div>

                      <div className="flex items-center gap-2">
                        <IconButton
                          label={state.editing ? 'Save' : 'Edit'}
                          onClick={() => {
                            if (state.editing) {
                              void handleSave(r);
                            } else {
                              setUi((prev) => ({
                                ...prev,
                                [r.staffTaskId]: { ...toRowUi(r), ...(prev[r.staffTaskId] ?? {}), editing: true },
                              }));
                            }
                          }}
                          disabled={state.saving}
                        >
                          {state.editing ? <Check className="h-4 w-4" /> : <SquarePen className="h-4 w-4" />}
                        </IconButton>

                        <IconButton
                          label={state.expanded ? 'Collapse' : 'Expand'}
                          onClick={() =>
                            setUi((prev) => {
                              const cur = prev[r.staffTaskId] ?? toRowUi(r);
                              return { ...prev, [r.staffTaskId]: { ...cur, expanded: !cur.expanded } };
                            })
                          }
                        >
                          <ChevronDown className={['h-4 w-4 transition-transform', state.expanded ? 'rotate-180' : ''].join(' ')} />
                        </IconButton>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Edit mode: bonus input appears */}
                {state.editing ? (
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                    <div className="text-sm text-slate-700">Bonus</div>
                    <input
                      inputMode="decimal"
                      className="h-9 w-28 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900 shadow-sm"
                      value={state.draftBonus}
                      onChange={(e) =>
                        setUi((prev) => {
                          const cur = prev[r.staffTaskId] ?? toRowUi(r);
                          return { ...prev, [r.staffTaskId]: { ...cur, draftBonus: e.target.value } };
                        })
                      }
                    />
                    <div className="text-sm text-slate-500">Defaults to 0</div>
                  </div>
                ) : null}

                {/* Expanded state: details */}
                {state.expanded ? (
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-sm font-semibold text-slate-900">Payment history</div>
                        <div className="mt-2 text-sm text-slate-600">Placeholder (Full/Partial status will appear here).</div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="text-sm font-semibold text-slate-900">Events this month</div>
                        <div className="mt-3 overflow-x-auto">
                          <table className="min-w-full text-left text-sm">
                            <thead className="text-xs uppercase tracking-wide text-slate-500">
                              <tr>
                                <th className="py-2 pr-3">Event</th>
                                <th className="py-2 text-right">Date</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {r.events.map((e) => (
                                <tr key={e.taskId} className="hover:bg-slate-50">
                                  <td className="py-2 pr-3 text-slate-900">{e.name}</td>
                                  <td className="py-2 text-right tabular-nums text-slate-700">{formatEventDate(e.requestedDateMs)}</td>
                                </tr>
                              ))}
                              {r.events.length === 0 ? (
                                <tr>
                                  <td colSpan={2} className="py-4 text-center text-slate-600">
                                    No events.
                                  </td>
                                </tr>
                              ) : null}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
