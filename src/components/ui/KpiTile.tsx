import type { ReactNode } from 'react';

import type { CategoryKey } from '@/ui/categoryTheme';
import { getCategoryTheme } from '@/ui/categoryTheme';

type KpiTileSize = 'sm' | 'md';

type KpiTileProps = {
  label: ReactNode;
  value: ReactNode;
  category?: CategoryKey;
  deltaLabel?: ReactNode;
  size?: KpiTileSize;
  className?: string;
};

export function KpiTile({ label, value, category, deltaLabel, size = 'md', className = '' }: KpiTileProps) {
  const t = category ? getCategoryTheme(category) : null;

  const padding = size === 'sm' ? 'p-3' : 'p-4';
  const valueSize = size === 'sm' ? 'text-lg' : 'text-2xl';

  return (
    <div
      className={[
        'group relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm',
        'transition hover:border-slate-300 hover:shadow-md',
        padding,
        className,
      ].join(' ')}
    >
      {t ? <div className={['absolute left-0 top-0 h-full w-1', t.accentBar].join(' ')} aria-hidden /> : null}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {t ? <span className={['h-2 w-2 rounded-full', t.accentDot].join(' ')} aria-hidden /> : null}
            <p className="truncate text-sm font-medium text-slate-600">{label}</p>
          </div>
          <div className={['mt-2 font-semibold tabular-nums tracking-tight text-slate-900', valueSize].join(' ')}>{value}</div>
        </div>
        {deltaLabel ? (
          <div className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {deltaLabel}
          </div>
        ) : null}
      </div>
    </div>
  );
}
