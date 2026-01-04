import { useEffect, useState } from 'react';
import { triggerSyncExpenses, triggerSyncIncome, type SyncId } from '@/lib/api/sync';

type LocalScriptStatus = 'success' | 'failed' | 'idle';

type LocalScriptState = {
  lastRunAt: string | null;
  lastStatus: LocalScriptStatus;
};

type LocalState = Record<SyncId, LocalScriptState>;

const LOCAL_STORAGE_KEY = 'ziv:scripts:lastRun';

function defaultLocalState(): LocalState {
  return {
    income: { lastRunAt: null, lastStatus: 'idle' },
    expenses: { lastRunAt: null, lastStatus: 'idle' },
  };
}

function loadLocalState(): LocalState {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return defaultLocalState();
    const parsed = JSON.parse(raw) as any;

    const base = defaultLocalState();
    for (const id of ['income', 'expenses'] as const) {
      const v = parsed?.[id];
      if (v && typeof v === 'object') {
        base[id] = {
          lastRunAt: typeof v.lastRunAt === 'string' ? v.lastRunAt : null,
          lastStatus: v.lastStatus === 'success' || v.lastStatus === 'failed' ? v.lastStatus : 'idle',
        };
      }
    }

    return base;
  } catch {
    return defaultLocalState();
  }
}

function saveLocalState(state: LocalState) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
}

function formatIso(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function statusBadge(status: 'idle' | 'running' | 'success' | 'failed') {
  const cls =
    status === 'success'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'failed'
        ? 'bg-rose-50 text-rose-700'
        : status === 'running'
          ? 'bg-slate-100 text-slate-700'
          : 'bg-slate-50 text-slate-600';

  const label = status === 'idle' ? 'Idle' : status === 'running' ? 'Running' : status === 'success' ? 'Success' : 'Failed';

  return <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${cls}`}>{label}</span>;
}

function ScriptCard(props: {
  title: string;
  syncId: SyncId;
  local: LocalScriptState;
  runtimeStatus: 'idle' | 'running' | 'success' | 'failed';
  lastResultText: string | null;
  errorMessage: string | null;
  onRun: () => void;
  disabled: boolean;
}) {
  const isRunning = props.runtimeStatus === 'running';
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900">{props.title}</h2>
            {statusBadge(props.runtimeStatus)}
          </div>
          <div className="text-sm text-slate-600">
            Last ran locally: <span className="font-medium text-slate-900">{formatIso(props.local.lastRunAt)}</span>
          </div>
          <div className="text-sm text-slate-600">
            Last status locally: <span className="font-medium text-slate-900">{props.local.lastStatus}</span>
          </div>
        </div>

        <button
          aria-busy={isRunning}
          className={[
            'rounded-lg px-3 py-2 text-sm font-medium shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60',
            isRunning ? 'bg-slate-200 text-slate-700 animate-pulse' : 'bg-slate-900 text-white hover:bg-slate-800',
          ].join(' ')}
          onClick={props.onRun}
          disabled={props.disabled}
        >
          {isRunning ? 'Running…' : 'Run'}
        </button>
      </div>

      {props.errorMessage ? <div className="mt-3 text-sm text-rose-700">{props.errorMessage}</div> : null}

      {props.lastResultText ? <div className="mt-3 text-sm text-slate-700">Result: {props.lastResultText}</div> : null}
    </div>
  );
}

export function ScriptsPage() {
  const [localState, setLocalState] = useState<LocalState>(() => loadLocalState());
  const [running, setRunning] = useState<Record<SyncId, { status: 'idle' | 'running' | 'success' | 'failed' }>>({
    income: { status: 'idle' },
    expenses: { status: 'idle' },
  });

  const [lastResultText, setLastResultText] = useState<Record<SyncId, string | null>>({ income: null, expenses: null });
  const [errors, setErrors] = useState<Record<SyncId, string | null>>({ income: null, expenses: null });

  // Persist local state across restarts
  useEffect(() => {
    saveLocalState(localState);
  }, [localState]);

  const canRun = true;

  const onRun = async (syncId: SyncId) => {
    setErrors((prev) => ({ ...prev, [syncId]: null }));
    setLastResultText((prev) => ({ ...prev, [syncId]: null }));
    setRunning((prev) => ({ ...prev, [syncId]: { status: 'running' } }));

    const res = syncId === 'income' ? await triggerSyncIncome() : await triggerSyncExpenses();

    if (!res.ok) {
      const msg = res.code === 'not_allowlisted' ? 'No access (not allowlisted)' : res.message;
      setRunning((prev) => ({ ...prev, [syncId]: { status: 'failed' } }));
      setErrors((prev) => ({ ...prev, [syncId]: msg }));
      setLocalState((prev) => ({
        ...prev,
        [syncId]: {
          lastRunAt: new Date().toISOString(),
          lastStatus: 'failed',
        },
      }));
      return;
    }

    setRunning((prev) => ({ ...prev, [syncId]: { status: 'success' } }));
    setLocalState((prev) => ({
      ...prev,
      [syncId]: {
        lastRunAt: new Date().toISOString(),
        lastStatus: 'success',
      },
    }));
    setLastResultText((prev) => ({ ...prev, [syncId]: res.resultText }));
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-900">Scripts</h1>
        <p className="text-sm text-slate-600">Run operational sync jobs in Cloud Functions.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ScriptCard
          title="Sync Income to ClickUp"
          syncId="income"
          local={localState.income}
          runtimeStatus={running.income.status}
          lastResultText={lastResultText.income}
          errorMessage={errors.income}
          onRun={() => onRun('income')}
          disabled={!canRun || running.income.status === 'running'}
        />
        <ScriptCard
          title="Sync Expenses to ClickUp"
          syncId="expenses"
          local={localState.expenses}
          runtimeStatus={running.expenses.status}
          lastResultText={lastResultText.expenses}
          errorMessage={errors.expenses}
          onRun={() => onRun('expenses')}
          disabled={!canRun || running.expenses.status === 'running'}
        />
      </div>
    </div>
  );
}
