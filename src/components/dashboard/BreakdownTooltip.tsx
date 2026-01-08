import type { MetricBreakdown } from '@/types/metrics';

function formatILSFromAgorot(amountAgorot: number) {
  const ils = amountAgorot / 100;
  try {
    return new Intl.NumberFormat('en-IL', {
      style: 'currency',
      currency: 'ILS',
      maximumFractionDigits: 2,
    }).format(ils);
  } catch {
    return `${ils} ₪`;
  }
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      <div className="h-3 w-40 animate-pulse rounded bg-slate-100" />
      <div className="h-3 w-56 animate-pulse rounded bg-slate-100" />
      <div className="h-3 w-48 animate-pulse rounded bg-slate-100" />
    </div>
  );
}

type BreakdownContentProps = {
  breakdown: MetricBreakdown;
};

/**
 * Renders the breakdown payload (discriminated union).
 */
export function BreakdownContent({ breakdown }: BreakdownContentProps) {
  if (breakdown.kind === 'none') return null;

  if (breakdown.kind === 'names') {
    const items =
      breakdown.metricKey === 'activeCustomers'
        ? [...breakdown.items].sort((a, b) => {
            const aMs = a.dateIso ? new Date(a.dateIso).getTime() : Number.NaN;
            const bMs = b.dateIso ? new Date(b.dateIso).getTime() : Number.NaN;
            const aValid = Number.isFinite(aMs);
            const bValid = Number.isFinite(bMs);

            if (aValid && bValid) return bMs - aMs;
            if (aValid) return -1;
            if (bValid) return 1;
            return a.name.localeCompare(b.name);
          })
        : breakdown.items;

    return (
      <ul className="space-y-1 text-sm text-slate-700">
        {items.map((item, idx) => (
          <li key={item.id ?? `${item.name}-${idx}`} className="break-words leading-snug text-slate-700">
            {breakdown.metricKey === 'activeCustomers' ? (
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 flex-1 break-words">{item.name}</span>
                <span className="shrink-0 tabular-nums text-xs text-slate-500">{item.dateIso ?? ''}</span>
              </div>
            ) : (
              <div className="break-words">{item.name}</div>
            )}
          </li>
        ))}
      </ul>
    );
  }

  if (breakdown.kind === 'line_items') {
    return (
      <ul className="space-y-2 text-sm">
        {breakdown.items.map((item, idx) => (
          <li key={item.id ?? `${item.name}-${idx}`} className="flex items-baseline justify-between gap-4">
            <span className="min-w-0 flex-1 break-words text-slate-700">{item.name}</span>
            <span className="shrink-0 tabular-nums text-slate-900">{formatILSFromAgorot(item.amountAgorot)}</span>
          </li>
        ))}
      </ul>
    );
  }

  return null;
}

type BreakdownTooltipProps = {
  title: string;
  status: 'loading' | 'ready' | 'error';
  breakdown: MetricBreakdown | null;
  errorMessage?: string;
};

/**
 * Tooltip panel content (dark, backdrop-blur) for metric breakdowns.
 */
export function BreakdownTooltip({ title, status, breakdown, errorMessage }: BreakdownTooltipProps) {
  return (
    <div className="w-[min(360px,var(--radix-popper-anchor-width,360px))] min-w-[260px] max-w-[calc(100vw-32px)]">
      <div className="mb-3">
        <div className="text-xs font-semibold tracking-wide text-slate-500">Calculation breakdown</div>
        <div className="mt-1 text-sm font-semibold text-slate-900">{title}</div>
      </div>

      <div className="max-h-80 overflow-y-auto pr-1">
        {status === 'loading' ? <LoadingSkeleton /> : null}

        {status === 'error' ? (
          <div className="text-sm text-slate-600">{errorMessage || 'Failed to load breakdown.'}</div>
        ) : null}

        {status === 'ready' && breakdown ? <BreakdownContent breakdown={breakdown} /> : null}
      </div>
    </div>
  );
}
