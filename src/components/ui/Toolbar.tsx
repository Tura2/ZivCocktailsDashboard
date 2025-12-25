import type { ReactNode } from 'react';

import type { DensityMode } from '@/ui/density';

type ToolbarProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  density?: DensityMode;
  onDensityChange?: (mode: DensityMode) => void;
  className?: string;
};

export function Toolbar({ title, subtitle, actions, density, onDensityChange, className = '' }: ToolbarProps) {
  return (
    <div className={[
      'flex flex-col gap-4 rounded-xl border border-slate-200 bg-white/70 p-4 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between',
      className,
    ].join(' ')}>
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle ? <div className="mt-1 text-sm text-slate-600">{subtitle}</div> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {onDensityChange && density ? (
          <div className="inline-flex overflow-hidden rounded-lg border border-slate-200 bg-white">
            <button
              type="button"
              className={[
                'px-3 py-2 text-sm font-medium',
                density === 'comfortable' ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-50',
              ].join(' ')}
              onClick={() => onDensityChange('comfortable')}
              aria-pressed={density === 'comfortable'}
            >
              Comfortable
            </button>
            <button
              type="button"
              className={[
                'border-l border-slate-200 px-3 py-2 text-sm font-medium',
                density === 'compact' ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-50',
              ].join(' ')}
              onClick={() => onDensityChange('compact')}
              aria-pressed={density === 'compact'}
            >
              Compact
            </button>
          </div>
        ) : null}

        {actions}
      </div>
    </div>
  );
}
