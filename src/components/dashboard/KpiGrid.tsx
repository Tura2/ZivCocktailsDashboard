import type { ReactNode } from 'react';

import MetricCard, { type TrendDirection } from '@/components/dashboard/MetricCard';
import type { CategoryKey } from '@/ui/categoryTheme';

type KpiItem = {
  key?: string;
  label: string;
  value: string | number;
  trendLabel?: string;
  trendDirection?: TrendDirection;
  hideTrend?: boolean;
  category?: CategoryKey;
};

type KpiGridProps = {
  items?: KpiItem[];
  children?: ReactNode;
  snapshotId?: string | null;
  snapshotVersion?: string | null;
  className?: string;
};

// Default grid is intentionally conservative (1–2 cols) so KPI cards don't get too narrow.
// Pages that have wider surfaces can opt into more columns via `className`.
const defaultGridClasses = 'grid grid-cols-1 gap-4 sm:grid-cols-2';

export default function KpiGrid({ items, children, snapshotId = null, snapshotVersion = null, className = '' }: KpiGridProps) {
  return (
    <div className={`${defaultGridClasses} ${className}`.trim()}>
      {items
        ? items.map((item) => (
            <MetricCard
              key={item.key ?? item.label}
              snapshotId={snapshotId}
              snapshotVersion={snapshotVersion}
              metricKey={item.key ?? null}
              label={item.label}
              value={item.value}
              trendLabel={item.trendLabel}
              trendDirection={item.trendDirection}
              hideTrend={item.hideTrend}
              category={item.category}
            />
          ))
        : children}
    </div>
  );
}
